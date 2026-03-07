# ============================================
# YourTable.top — Production Dockerfile
# ============================================
# Multi-stage: builds API, Web, Widget, then runs everything
#
# Build:  docker build -t yourtable .
# Run:    docker run -p 3001:3001 --env-file .env yourtable

# ──────────────────────────────────────────────
# Stage 1: Base with pnpm
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ──────────────────────────────────────────────
# Stage 2: Install dependencies
# ──────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
COPY packages/widget/package.json packages/widget/
RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────────────
# Stage 3: Build shared package
# ──────────────────────────────────────────────
FROM deps AS build-shared
COPY packages/shared/ packages/shared/
COPY tsconfig.json ./
RUN pnpm --filter @yourtable/shared build

# ──────────────────────────────────────────────
# Stage 4: Build API
# ──────────────────────────────────────────────
FROM build-shared AS build-api
COPY packages/api/ packages/api/
RUN pnpm --filter @yourtable/api db:generate
RUN pnpm --filter @yourtable/api build

# ──────────────────────────────────────────────
# Stage 5: Build Web (admin panel)
# ──────────────────────────────────────────────
FROM build-shared AS build-web
COPY packages/web/ packages/web/
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN pnpm --filter @yourtable/web build

# ──────────────────────────────────────────────
# Stage 6: Build Widget (embeddable)
# ──────────────────────────────────────────────
FROM build-shared AS build-widget
COPY packages/widget/ packages/widget/
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @yourtable/widget build

# ──────────────────────────────────────────────
# Stage 7: Production runtime
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache nginx

WORKDIR /app

# Copy API build + deps
COPY --from=build-api /app/packages/api/dist/ packages/api/dist/
COPY --from=build-api /app/packages/api/package.json packages/api/
COPY --from=build-api /app/packages/api/node_modules/ packages/api/node_modules/
COPY --from=build-api /app/packages/api/prisma/ packages/api/prisma/
COPY --from=build-shared /app/packages/shared/ packages/shared/
COPY --from=deps /app/node_modules/ node_modules/
COPY package.json pnpm-workspace.yaml ./

# Copy static builds
COPY --from=build-web /app/packages/web/dist/ /var/www/web/
COPY --from=build-widget /app/packages/widget/dist/ /var/www/widget/

# Nginx config
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Startup script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3001 80

CMD ["/app/start.sh"]
