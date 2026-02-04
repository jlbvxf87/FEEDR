/**
 * FEEDR Skill for OpenClaw
 * 
 * This skill allows OpenClaw to generate videos and images via FEEDR.
 * Install this skill in your OpenClaw instance to enable content generation.
 */

import { Skill, SkillContext, SkillResult } from '@openclaw/sdk';

interface FeedRequest {
  input: string;
  output_type?: 'video' | 'image';
  preset_key?: string;
  image_pack?: string;
}

interface BatchStatus {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  clips: Array<{
    id: string;
    status: string;
    final_url?: string;
  }>;
}

export default class FeedrSkill implements Skill {
  name = 'feedr';
  
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor(ctx: SkillContext) {
    this.supabaseUrl = ctx.env.FEEDR_SUPABASE_URL;
    this.supabaseKey = ctx.env.FEEDR_SUPABASE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('FEEDR_SUPABASE_URL and FEEDR_SUPABASE_KEY are required');
    }
  }
  
  /**
   * Generate content (videos or images)
   */
  async generate_content(params: FeedRequest): Promise<SkillResult> {
    const { input, output_type = 'video', preset_key, image_pack } = params;
    
    // Call FEEDR's /feed endpoint (OpenClaw orchestrated)
    const response = await fetch(`${this.supabaseUrl}/functions/v1/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
      body: JSON.stringify({
        input,
        output_type,
        preset_key,
        image_pack,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `Failed to generate content: ${error}`,
      };
    }
    
    const data = await response.json();
    
    // Start polling for completion
    const batchId = data.batch_id;
    const batchStatus = await this.pollBatchStatus(batchId);
    
    if (batchStatus.status === 'done') {
      const readyClips = batchStatus.clips.filter(c => c.final_url);
      return {
        success: true,
        message: `Generated ${readyClips.length} ${output_type}s!`,
        data: {
          batch_id: batchId,
          intent: data.intent,
          clips: readyClips.map(c => ({
            id: c.id,
            url: c.final_url,
          })),
          view_url: `https://feedr-two.vercel.app/?batch=${batchId}`,
        },
      };
    } else if (batchStatus.status === 'failed') {
      return {
        success: false,
        message: 'Generation failed. Please try again.',
        data: { batch_id: batchId },
      };
    } else {
      // Still running, return progress
      return {
        success: true,
        message: `Generation in progress... Check back in a moment.`,
        data: {
          batch_id: batchId,
          status: batchStatus.status,
          progress: `${batchStatus.clips.filter(c => c.status === 'ready').length}/${batchStatus.clips.length} ready`,
        },
      };
    }
  }
  
  /**
   * Check batch status
   */
  async check_batch_status(params: { batch_id: string }): Promise<SkillResult> {
    const status = await this.getBatchStatus(params.batch_id);
    
    if (!status) {
      return {
        success: false,
        message: 'Batch not found',
      };
    }
    
    const readyCount = status.clips.filter(c => c.status === 'ready').length;
    const totalCount = status.clips.length;
    
    return {
      success: true,
      message: `Batch ${status.status}: ${readyCount}/${totalCount} ready`,
      data: {
        batch_id: params.batch_id,
        status: status.status,
        clips: status.clips.map(c => ({
          id: c.id,
          status: c.status,
          url: c.final_url,
        })),
      },
    };
  }
  
  /**
   * List recent batches
   */
  async list_recent_batches(params: { limit?: number }): Promise<SkillResult> {
    const limit = params.limit || 5;
    
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/batches?select=id,intent_text,status,created_at&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );
    
    if (!response.ok) {
      return {
        success: false,
        message: 'Failed to fetch batches',
      };
    }
    
    const batches = await response.json();
    
    return {
      success: true,
      message: `Found ${batches.length} recent batches`,
      data: { batches },
    };
  }
  
  // Helper: Get batch status
  private async getBatchStatus(batchId: string): Promise<BatchStatus | null> {
    const [batchRes, clipsRes] = await Promise.all([
      fetch(`${this.supabaseUrl}/rest/v1/batches?id=eq.${batchId}&select=*`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }),
      fetch(`${this.supabaseUrl}/rest/v1/clips?batch_id=eq.${batchId}&select=id,status,final_url&order=variant_id`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }),
    ]);
    
    if (!batchRes.ok || !clipsRes.ok) return null;
    
    const [batches, clips] = await Promise.all([
      batchRes.json(),
      clipsRes.json(),
    ]);
    
    if (batches.length === 0) return null;
    
    return {
      id: batches[0].id,
      status: batches[0].status,
      clips,
    };
  }
  
  // Helper: Poll until batch is done or timeout
  private async pollBatchStatus(batchId: string, maxWaitMs = 180000): Promise<BatchStatus> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBatchStatus(batchId);
      
      if (!status) {
        throw new Error('Batch not found');
      }
      
      if (status.status === 'done' || status.status === 'failed') {
        return status;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Return current status on timeout
    const finalStatus = await this.getBatchStatus(batchId);
    return finalStatus || { id: batchId, status: 'running', clips: [] };
  }
}
