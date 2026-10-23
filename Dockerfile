# syntax=docker/dockerfile:1

# ---- Dependências (inclui o binário nativo do Argon2 para Linux) ----
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- Build (saída standalone do Next.js) ----
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runtime mínimo, sem root ----
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/app/storage \
    BACKUP_DIR=/app/backups

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Scripts operacionais (backup, restauração, verificação, bootstrap do admin).
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/src/server/security/envelope.ts /app/src/server/security/argon2-options.ts ./src/server/security/

RUN mkdir -p /app/storage /app/backups && chown node:node /app/storage /app/backups
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next
USER 1000:1000

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
