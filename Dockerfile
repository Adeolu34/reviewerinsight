FROM node:20-slim

# Unprivileged runtime user (the entrypoint drops to it after fixing volume ownership)
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app/server

# System deps for Remotion (headless Chrome) + ffmpeg
RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libxkbcommon0 \
  libasound2 \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Server dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Remotion video dependencies
WORKDIR /app/video
COPY video/package*.json ./
RUN npm ci --legacy-peer-deps

WORKDIR /app/server

# Copy source
COPY server/src/ ./src/
COPY server/scripts/ ./scripts/
COPY video/ /app/video/

# Copy frontend static files
COPY project/ /app/project/

# Data directories + ownership (Remotion writes to /app/video, the server to the data dirs)
RUN mkdir -p /var/data/reviewinsight/videos /var/data/reviewinsight/nature-live /var/data/reviewinsight/football \
 && chown -R app:app /app /var/data/reviewinsight

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV VIDEO_OUTPUT_DIR=/var/data/reviewinsight/videos

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
