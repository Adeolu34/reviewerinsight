FROM node:20-alpine

WORKDIR /app/server

# Install dependencies first (cached layer)
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source code
COPY server/src/ ./src/
COPY server/scripts/ ./scripts/

# Copy frontend static files (preserves path.join(__dirname, '../../project'))
COPY project/ /app/project/

EXPOSE 3001

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "src/index.js"]
