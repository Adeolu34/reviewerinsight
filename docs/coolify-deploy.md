# Coolify deployment

## "pull access denied for cmo60620k0000p49sbuko22ub"

Coolify builds the image locally as `<resource-uuid>:<git-sha>` then runs `docker compose up`. Compose defaults to **pulling** that image name from Docker Hub, which fails.

**Fix (in repo):** `docker-compose.yml` sets `pull_policy: never` on the app service so Compose uses the image that was just built.

Redeploy after pulling latest `main`.

## Compose file

| File | Use |
|------|-----|
| `docker-compose.yml` | Local dev (app + MongoDB container) |
| `docker-compose.coolify.yml` | Production: app only; set `MONGODB_URI` in Coolify env |

In Coolify → your app → **Build** → set **Docker Compose file** to `docker-compose.coolify.yml` if you use Atlas/external MongoDB.

## Required env (Coolify)

- `MONGODB_URI`
- `OPENROUTER_API_KEY` (or `OPENAI_API_KEY`)
- `ADMIN_API_KEY`, `JWT_SECRET`
- `PUBLIC_SITE_URL` (your public HTTPS URL, no trailing slash)
- `NATURE_LIVE_DIR=/var/data/reviewinsight/nature-live` (mount volume below)
- API keys as needed: `PEXELS_API_KEY`, `FREESOUND_API_KEY`, etc.

## Volumes

Mount persistent storage at:

- `/var/data/reviewinsight/videos`
- `/var/data/reviewinsight/nature-live`

These match `docker-compose.coolify.yml` volume mounts.

## Build time

The Dockerfile installs **ffmpeg + Chromium** (~900MB). First deploy can take **5–10 minutes**. Later deploys use layer cache.

## Alternative: Dockerfile-only deploy

In Coolify, switch build pack from **Docker Compose** to **Dockerfile** (single container, no compose pull issue). Point **Publish directory** / port to `3000` and set env vars in the UI.
