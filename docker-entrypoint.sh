#!/bin/sh
# Starts as root only long enough to make bind-mounted data dirs writable, then drops to the
# unprivileged "app" user for the Node process. Set RUN_AS_ROOT=true to skip the drop (escape hatch).
set -e

for dir in "${VIDEO_OUTPUT_DIR:-/var/data/reviewinsight/videos}" \
           "${NATURE_LIVE_DIR:-/var/data/reviewinsight/nature-live}" \
           "/var/data/reviewinsight/football"; do
  mkdir -p "$dir"
  # Only chown when the top-level owner differs (avoids a slow recursive walk on every boot)
  if [ "$(stat -c %u "$dir")" != "$(id -u app)" ]; then
    chown -R app:app "$dir" 2>/dev/null || echo "[entrypoint] warning: could not chown $dir"
  fi
done

if [ "$RUN_AS_ROOT" = "true" ] || [ "$(id -u)" != "0" ]; then
  exec "$@"
fi

exec setpriv --reuid=app --regid=app --init-groups "$@"
