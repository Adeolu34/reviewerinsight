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
| `FREESOUND_API_KEY` | Optional | CC0 ambient audio fallback if ElevenLabs unavailable |
| `NATURE_LIVE_DIR` | No | Asset storage (default: `nature-live/` under repo) |
| `NATURE_LIVE_AUTO_RESUME` | No | `true` = restart ffmpeg for streams marked `live` on boot |
| `NATURE_WATCHDOG_INTERVAL_MS` | No | Default `60000` — restart dead encoders |
| `NATURE_FFMPEG_PRESET` | No | Default `veryfast` |
| `NATURE_VIDEO_BITRATE` | No | Default `2500k` |
| `NATURE_STREAM_RESOLUTION` | No | Default `1920:1080` |

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

## Operations

1. **Regenerate** — builds `audio_loop.mp3`, `video_loop.mp4`, `thumbnail.jpg` under `{NATURE_LIVE_DIR}/{themeId}/`
2. **Start** — creates YouTube live session + starts ffmpeg (stagger starts if CPU spikes)
3. **Stop** / **Stop all** — kills ffmpeg and completes broadcast
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
- `POST /api/admin/nature-live/:themeId/start`
- `POST /api/admin/nature-live/:themeId/stop`
- `POST /api/admin/nature-live/stop-all`

Public: `GET /api/admin/nature-live/youtube/callback`
