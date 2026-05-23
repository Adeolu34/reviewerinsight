# Nature Live — 24/7 YouTube ambient streams

## Overview

Admin → **Nature Live** runs up to **7** concurrent RTMP livestreams to a **separate** YouTube channel (not the book-review Videos channel).

Pipeline per theme:

1. Generate assets (looping ~30s audio + looping video + thumbnail)
2. Create YouTube `liveStream` + `liveBroadcast` and bind
3. `ffmpeg` pushes looped video + audio to YouTube ingest until stopped

## Google Cloud setup

1. Use the same OAuth client as book YouTube (`YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`).
2. Add **authorized redirect URI**:
   - `https://YOUR_DOMAIN/api/admin/nature-live/youtube/callback`
3. Enable **YouTube Data API v3** and ensure the Google account has **live streaming enabled** on the nature channel.
4. In Admin → Nature Live → **Connect Nature Channel**, sign in with the **nature** Google account (not the book-review account).

Optional: store token in env `NATURE_YOUTUBE_REFRESH_TOKEN` instead of MongoDB `nature_youtube_refresh_token`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_CLIENT_ID` | Yes | OAuth client |
| `YOUTUBE_CLIENT_SECRET` | Yes | OAuth client |
| `NATURE_YOUTUBE_REFRESH_TOKEN` | No* | Nature channel refresh token (*or DB after OAuth) |
| `NATURE_YOUTUBE_REDIRECT_URI` | No | Defaults to `{origin}/api/admin/nature-live/youtube/callback` |
| `ELEVENLABS_API_KEY` | Recommended | Ambient audio via Sound Effects API (reuses book-video key) |
| `NATURE_AUDIO_PROVIDER` | No | `auto` (default), `elevenlabs`, `freesound`, or `noise` |
| `PEXELS_API_KEY` | Recommended | Stock nature video (first provider in chain) |
| `PIXABAY_API_KEY` | Recommended | Free stock video fallback — [pixabay.com/api/docs](https://pixabay.com/api/docs/) |
| `NATURE_VIDEO_PROVIDERS` | No | Comma order, default `pexels,pixabay` |
| `FREESOUND_API_KEY` | Optional | Freesound **Client secret/Api key** (token auth for search + previews) |
| `FREESOUND_CLIENT_SECRET` | Optional | Alias for the same API key value |
| `FREESOUND_CLIENT_ID` | No | OAuth only — **not** used for Nature Live ambient search |
| `NATURE_LIVE_DIR` | No | Asset storage (default: `nature-live/` under repo) |
| `NATURE_LIVE_AUTO_RESUME` | No | `true` = restart ffmpeg for streams marked `live` on boot |
| `NATURE_WATCHDOG_INTERVAL_MS` | No | Default `60000` — restart dead encoders |
| `NATURE_FFMPEG_PRESET` | No | Default `veryfast` |
| `NATURE_VIDEO_BITRATE` | No | Default `2500k` |
| `NATURE_STREAM_RESOLUTION` | No | Default `1920:1080` |

## Automatic storage cleanup

The server runs **storage cleanup** on a schedule (default every **6 hours**, plus **60s after boot** and after each **Export 15m test** completes).

It removes:

- Old **test_\*min.mp4** exports (default older than **72h**)
- Orphan **audio_raw / video_raw / \_trim** temp files
- Old **ffmpeg logs** under each theme
- **Failed** book video files older than **14 days** (DB paths cleared)

If free space on the nature volume drops below **`STORAGE_CLEANUP_MIN_FREE_MB`** (default **2048**), cleanup runs in **aggressive** mode (may delete old test exports even if still referenced).

Manual trigger: `POST /api/admin/system/cleanup-storage` with optional `{ "aggressive": true }`.

Admin **System** page JSON includes `storage.lastCleanup` and volume free space.

## Docker / hosting (same container as API)

The Dockerfile already installs **ffmpeg**. For 7× 1080p streams plan roughly:

- **CPU:** 4–8 vCPU
- **Upload:** 15–35 Mbps sustained
- **Disk:** volume mount for `NATURE_LIVE_DIR`

Example Coolify/env:

```env
NATURE_LIVE_DIR=/var/data/reviewinsight/nature-live
NATURE_LIVE_AUTO_RESUME=true
ELEVENLABS_API_KEY=...
PEXELS_API_KEY=...
PIXABAY_API_KEY=...
FREESOUND_API_KEY=...
```

Mount `/var/data/reviewinsight/nature-live` as a persistent volume.

## Operations (4-step workflow)

1. **Build assets** — looping `audio_loop.mp3`, `video_loop.mp4`, `thumbnail.jpg` under `{NATURE_LIVE_DIR}/{themeId}/`
2. **Preview local** — play video + audio in admin before YouTube
3. **Prepare (YT preview)** — creates YouTube broadcast, pushes RTMP, enters **testing** (not public yet). Open **Studio ↗** to preview.
4. **Go live** — transitions broadcast to public **live**

**Stop** / **Stop all** — kills ffmpeg and completes broadcast
4. Logs: `{NATURE_LIVE_DIR}/{themeId}/logs/ffmpeg-{themeId}.log`

## Themes (7 slots)

`rain`, `thunder`, `wind`, `ocean`, `birds`, `breeze`, `footsteps`

## Compliance

- Use licensed media (Pexels/Pixabay video, ElevenLabs SFX or Freesound CC0) to reduce Content ID risk.
- ElevenLabs SFX uses credits (~40/sec when duration is set); one 30s clip per theme on regenerate.
- 24/7 streams may drop; watchdog + `NATURE_LIVE_AUTO_RESUME` help recover.

## API (admin JWT)

- `GET /api/admin/nature-live/status`
- `GET /api/admin/nature-live/youtube/auth-url`
- `DELETE /api/admin/nature-live/youtube/disconnect`
- `POST /api/admin/nature-live/:themeId/generate-assets`
- `GET /api/admin/nature-live/:themeId/preview/video`
- `GET /api/admin/nature-live/:themeId/preview/audio`
- `POST /api/admin/nature-live/:themeId/prepare`
- `POST /api/admin/nature-live/:themeId/go-live`
- `POST /api/admin/nature-live/:themeId/start` (optional one-click if `NATURE_SKIP_PREVIEW=true`)
- `POST /api/admin/nature-live/:themeId/stop`
- `POST /api/admin/nature-live/stop-all`

Public: `GET /api/admin/nature-live/youtube/callback`
