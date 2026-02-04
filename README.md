# FEEDR Terminal

One-touch content arbitrage terminal. Type an idea, pick a vibe, generate clips, review in TikTok-style feed, choose winners.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### 3. Set Up Database

Apply the migrations to your Supabase project. You can do this via:

**Option A: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the contents of each migration file in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed_presets.sql`

**Option B: Supabase CLI**
```bash
supabase db push
```

### 4. Create Storage Buckets

In your Supabase dashboard, create these storage buckets:
- `assets` (private)
- `voice` (private)
- `raw` (private)
- `final` (private)
- `previews` (private)

### 5. Deploy Edge Functions

```bash
supabase functions deploy generate-batch
supabase functions deploy worker
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Sign in** with email/password
2. **Type an intent** in the input bar (e.g., "KEI hair breakage - hook test")
3. **Select a preset** (vibe) from the 3x3 grid, or leave on AUTO
4. **Choose mode** (Hooks/Angles/Formats) and batch size (5/10/15)
5. **Click Generate** to start manufacturing clips
6. **Watch progress** in the Manufacturing panel
7. **Click a clip** to open TikTok-style viewer
8. **Mark winners/kills** and download clips

## Keyboard Shortcuts (in Video Viewer)

| Key | Action |
|-----|--------|
| J / Arrow Down | Next clip |
| K / Arrow Up | Previous clip |
| W | Toggle winner |
| X | Toggle killed |
| D | Download clip |
| Space | Play/Pause |
| Esc | Close viewer |

## Dev Mode

Add `?dev=1` to the URL to show the "Run Worker" button. This lets you manually trigger the worker to process jobs during development.

## Project Structure

```
FEEDR/
├── app/                      # Next.js App Router
│   ├── (auth)/login/         # Login page
│   ├── (main)/               # Main app (protected)
│   └── api/auth/             # Auth API routes
├── components/               # React components
│   ├── InputBar.tsx          # Intent input + controls
│   ├── PresetGrid.tsx        # 3x3 preset selection
│   ├── ResultsGrid.tsx       # 3x3 clip results
│   ├── ManufacturingPanel.tsx# Progress display
│   ├── VideoModalFeed.tsx    # TikTok-style viewer
│   └── ClipActions.tsx       # Winner/Kill/Download
├── lib/                      # Utilities
│   ├── supabaseBrowser.ts    # Client-side Supabase
│   ├── supabaseServer.ts     # Server-side Supabase
│   ├── types.ts              # TypeScript types
│   ├── api.ts                # API functions
│   └── utils.ts              # Utility functions
├── supabase/
│   ├── migrations/           # SQL migrations
│   └── functions/            # Edge functions
└── middleware.ts             # Auth middleware
```

## Presets

| Key | Name | Description |
|-----|------|-------------|
| AUTO | Auto | Best guess based on intent |
| RAW_UGC_V1 | Raw UGC | Camera-down, raw captions |
| TIKTOK_AD_V1 | TikTok Ad | Captions + comments + progress bar + endcard |
| PODCAST_V1 | Podcast | Authority clip, clean look |
| SENSORY_V1 | Sensory | Texture/curiosity pacing |
| CLEAN_V1 | Clean | Minimal, no overlays |
| STORY_V1 | Story | Story-style with progress |
| HOOK_V1 | Hook Heavy | Bold hooks, fast cuts |
| MINIMAL_V1 | Minimal | Subtle captions only |

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Rendering**: Mocked pipeline (ready for OpenAI/ElevenLabs/Sora integration)

## License

Internal tool - not for distribution.
