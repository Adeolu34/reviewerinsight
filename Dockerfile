FROM node:20-slim

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
RUN npm install --legacy-peer-deps

WORKDIR /app/server

# Copy source
COPY server/src/ ./src/
COPY server/scripts/ ./scripts/
COPY video/ /app/video/

# Copy frontend static files
COPY project/ /app/project/

# Video output directory
RUN mkdir -p /var/data/reviewinsight/videos

EXPOSE 3000

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV VIDEO_OUTPUT_DIR=/var/data/reviewinsight/videos

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
