# syntax=docker/dockerfile:1
#
# Builds a single image that serves the whole app (API + frontend) from one
# origin: Fastify answers /api/* itself and serves the built frontend (with
# an SPA fallback) for everything else. See docker-compose.yml for how this
# image is run alongside MariaDB and an optional bundled Ollama.

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty base means every request goes to the page's own origin (/api/...),
# which is what single-origin production serving needs.
ENV VITE_API_BASE=""
RUN npm run build

FROM node:22-bookworm-slim AS api-build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 apr \
    && useradd --system --uid 1001 --gid apr --home-dir /app --shell /usr/sbin/nologin apr

WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# tsc only compiles .ts sources, so the migration runner's non-TS assets are
# copied in separately, alongside the .js it was compiled to.
COPY --from=api-build /app/api/dist ./dist
COPY --from=api-build /app/api/src/db/schema.sql ./dist/db/schema.sql
COPY --from=api-build /app/api/src/db/migrations ./dist/db/migrations
COPY --from=frontend-build /app/frontend/dist ./public
COPY api/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/.review-work \
    && chown -R apr:apr /app \
    && chmod +x ./docker-entrypoint.sh

USER apr
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
ENV REPO_WORK_ROOT=/app/.review-work
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
