"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import { Trash2, HardDrive, Clock, Star, X } from "lucide-react";

interface StorageStats {
  total_clips: number;
  winners: number;
  killed: number;
  deleted: number;
  active_with_files: number;
}

interface RetentionSetting {
  setting_key: string;
  setting_value: string;
  description: string;
}

interface CleanupLog {
  id: string;
  executed_at: string;
  clips_deleted: number;
  files_deleted: number;
}

export function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [settings, setSettings] = useState<RetentionSetting[]>([]);
  const [recentCleanups, setRecentCleanups] = useState<CleanupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCleanup, setRunningCleanup] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load storage summary
      const { data: summaryData } = await supabase
        .from("storage_summary")
        .select("*")
        .eq("type", "clips")
        .single();
      
      if (summaryData) {
        setStats(summaryData as StorageStats);
      }

      // Load retention settings
      const { data: settingsData } = await supabase
        .from("retention_settings")
        .select("*");
      
      if (settingsData) {
        setSettings(settingsData as RetentionSetting[]);
      }

      // Load recent cleanups
      const { data: cleanupData } = await supabase
        .from("cleanup_log")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(5);
      
      if (cleanupData) {
        setRecentCleanups(cleanupData as CleanupLog[]);
      }
    } catch (e) {
      console.error("Error loading storage data:", e);
    } finally {
      setLoading(false);
    }
  };

  const runManualCleanup = async () => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup", {});
      if (error) throw error;
      console.log("Cleanup result:", data);
      await loadData(); // Refresh stats
    } catch (e) {
      console.error("Cleanup failed:", e);
    } finally {
      setRunningCleanup(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      await supabase
        .from("retention_settings")
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq("setting_key", key);
      
      setSettings(prev => 
        prev.map(s => s.setting_key === key ? { ...s, setting_value: value } : s)
      );
    } catch (e) {
      console.error("Failed to update setting:", e);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1C2230] rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-[#2D3748] rounded w-1/3 mb-4" />
        <div className="h-20 bg-[#2D3748] rounded" />
      </div>
    );
  }

  const getSetting = (key: string) => 
    settings.find(s => s.setting_key === key)?.setting_value || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-[#2EE6C9]" />
          Storage & Cleanup
        </h2>
        <button
          onClick={runManualCleanup}
          disabled={runningCleanup}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "bg-red-500/10 text-red-400 hover:bg-red-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2"
          )}
        >
          <Trash2 className="w-4 h-4" />
          {runningCleanup ? "Cleaning..." : "Run Cleanup"}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Clips"
          value={stats?.total_clips || 0}
          icon={<HardDrive className="w-4 h-4" />}
        />
        <StatCard
          label="Winners"
          value={stats?.winners || 0}
          icon={<Star className="w-4 h-4" />}
          color="text-yellow-400"
        />
        <StatCard
          label="Killed"
          value={stats?.killed || 0}
          icon={<X className="w-4 h-4" />}
          color="text-red-400"
        />
        <StatCard
          label="Active Files"
          value={stats?.active_with_files || 0}
          icon={<HardDrive className="w-4 h-4" />}
          color="text-[#2EE6C9]"
        />
      </div>

      {/* Retention Settings */}
      <div className="bg-[#1C2230] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#6B7280]" />
          Retention Policy
        </h3>
        
        <div className="space-y-4">
          <SettingRow
            label="Delete killed clips after"
            value={getSetting("killed_retention_hours")}
            unit="hours"
            onChange={(v) => updateSetting("killed_retention_hours", v)}
          />
          <SettingRow
            label="Delete non-winners after"
            value={getSetting("non_winner_retention_days")}
            unit="days"
            onChange={(v) => updateSetting("non_winner_retention_days", v)}
          />
          <SettingRow
            label="Delete winners after"
            value={getSetting("winner_retention_days")}
            unit="days"
            onChange={(v) => updateSetting("winner_retention_days", v)}
          />
          
          <div className="flex items-center justify-between pt-2 border-t border-[#2D3748]">
            <span className="text-sm text-[#9CA3AF]">Auto-cleanup enabled</span>
            <button
              onClick={() => updateSetting(
                "cleanup_enabled",
                getSetting("cleanup_enabled") === "true" ? "false" : "true"
              )}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                getSetting("cleanup_enabled") === "true"
                  ? "bg-[#2EE6C9]"
                  : "bg-[#2D3748]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all",
                  getSetting("cleanup_enabled") === "true" ? "left-6" : "left-0.5"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Cleanups */}
      {recentCleanups.length > 0 && (
        <div className="bg-[#1C2230] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-4">Recent Cleanups</h3>
          <div className="space-y-2">
            {recentCleanups.map((cleanup) => (
              <div
                key={cleanup.id}
                className="flex items-center justify-between text-sm py-2 border-b border-[#2D3748] last:border-0"
              >
                <span className="text-[#6B7280]">
                  {new Date(cleanup.executed_at).toLocaleString()}
                </span>
                <span className="text-[#9CA3AF]">
                  {cleanup.clips_deleted} clips, {cleanup.files_deleted} files
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-white",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-[#1C2230] rounded-xl p-4">
      <div className="flex items-center gap-2 text-[#6B7280] mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
    </div>
  );
}

function SettingRow({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#9CA3AF]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 px-2 py-1 rounded bg-[#0B0E11] border border-[#2D3748] text-white text-sm text-center"
        />
        <span className="text-xs text-[#6B7280]">{unit}</span>
      </div>
    </div>
  );
}
