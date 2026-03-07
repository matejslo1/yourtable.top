# ============================================
# YourTable.top — Production Dockerfile
# ============================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ──────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
COPY packages/widget/package.json packages/widget/
RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────────────
# Stage 2: Build shared
# ──────────────────────────────────────────────
FROM deps AS build-shared
COPY packages/shared/ packages/shared/
COPY tsconfig.json ./
RUN pnpm --filter @yourtable/shared build

RUN node -e "const p=require('./packages/shared/package.json');p.main='./dist/index.js';p.types='./dist/index.d.ts';p.exports={'.':{'import':'./dist/index.js','types':'./dist/index.d.ts'}};require('fs').writeFileSync('./packages/shared/package.json',JSON.stringify(p,null,2))"

# ──────────────────────────────────────────────
# Stage 3: Build API
# ──────────────────────────────────────────────
FROM build-shared AS build-api
COPY packages/api/ packages/api/
RUN pnpm --filter @yourtable/api db:generate
RUN pnpm --filter @yourtable/api build

# ──────────────────────────────────────────────
# Stage 4: Build Web
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
# Stage 5: Build Widget
# ──────────────────────────────────────────────
FROM build-shared AS build-widget
COPY packages/widget/ packages/widget/
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @yourtable/widget build

# ──────────────────────────────────────────────
# Stage 6: Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache nginx

WORKDIR /app

# Workspace root deps
COPY --from=deps /app/node_modules/ node_modules/
COPY package.json pnpm-workspace.yaml ./

# API
COPY --from=build-api /app/packages/api/dist/ packages/api/dist/
COPY --from=build-api /app/packages/api/package.json packages/api/
COPY --from=build-api /app/packages/api/node_modules/ packages/api/node_modules/
COPY --from=build-api /app/packages/api/prisma/ packages/api/prisma/

# Shared
COPY --from=build-shared /app/packages/shared/dist/ packages/shared/dist/
COPY --from=build-shared /app/packages/shared/package.json packages/shared/
COPY --from=build-shared /app/packages/shared/node_modules/ packages/shared/node_modules/

# Fix local workspace resolution for shared inside api
RUN rm -rf packages/api/node_modules/@yourtable/shared && \
    mkdir -p packages/api/node_modules/@yourtable && \
    ln -s /app/packages/shared packages/api/node_modules/@yourtable/shared

# Static assets
COPY --from=build-web /app/packages/web/dist/ /var/www/web/
COPY --from=build-widget /app/packages/widget/dist/ /var/www/widget/

# Nginx
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Startup
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3001 80

CMD ["/app/start.sh"]