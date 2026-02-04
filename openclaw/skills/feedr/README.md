# FEEDR Skill for OpenClaw

This skill allows your OpenClaw instance to generate viral videos and product images using FEEDR's AI pipeline.

## Installation

### Method 1: Via OpenClaw CLI (Recommended)

```bash
# In your OpenClaw directory
openclaw skill install https://github.com/jlbvxf87/FEEDR/tree/main/openclaw/skills/feedr
```

### Method 2: Via Chat

Just tell your OpenClaw:
> "Install the FEEDR skill from https://github.com/jlbvxf87/FEEDR"

OpenClaw will clone and set it up automatically.

### Method 3: Manual

1. Copy this folder to your OpenClaw's `skills/` directory
2. Add environment variables to your OpenClaw config:
   ```
   FEEDR_SUPABASE_URL=https://your-project.supabase.co
   FEEDR_SUPABASE_KEY=your-service-role-key
   ```
3. Restart OpenClaw

## Usage

Once installed, you can talk to your OpenClaw naturally:

### Generate Videos
```
You: "Make me a viral video about my new sneakers"
🦞: "On it! Generating 3 video variations..."
🦞: "Done! Here are your videos: [link] Pick your winner!"
```

### Generate Images
```
You: "Create product photos for my coffee mug"
🦞: "Generating 9 product images with different styles..."
🦞: "Here's your image pack! [link]"
```

### Check Status
```
You: "What's the status of my last video batch?"
🦞: "Batch abc123: 3/3 videos ready. View them here: [link]"
```

### List Recent Work
```
You: "Show me my recent FEEDR batches"
🦞: "Here are your last 5 batches: ..."
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FEEDR_SUPABASE_URL` | Yes | Your FEEDR Supabase project URL |
| `FEEDR_SUPABASE_KEY` | Yes | Supabase service role key |

## How It Works

```
You: "Make a sneaker video"
        ↓
OpenClaw understands intent
        ↓
Calls FEEDR /feed endpoint
        ↓
FEEDR's internal OpenClaw parses → generates → assembles
        ↓
OpenClaw polls for completion
        ↓
Returns results to you
```

## Capabilities

| Capability | Description |
|------------|-------------|
| `generate_content` | Create videos or images from a text prompt |
| `check_batch_status` | Check progress of a generation job |
| `list_recent_batches` | See your recent generations |

## Support

- FEEDR Issues: https://github.com/jlbvxf87/FEEDR/issues
- OpenClaw Discord: https://discord.gg/openclaw
