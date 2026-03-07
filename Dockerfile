# ============================================
# YourTable.top — Production Dockerfile
# ============================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ──────────────────────────────────────────────
# Stage 1: Install all deps for build
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
RUN node -e "const fs=require('fs');const p=require('./packages/shared/package.json');p.main='./dist/index.js';p.types='./dist/index.d.ts';p.exports={'.':{'import':'./dist/index.js','types':'./dist/index.d.ts'}};fs.writeFileSync('./packages/shared/package.json',JSON.stringify(p,null,2))"

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
# Stage 6: Deploy API
# ──────────────────────────────────────────────
FROM build-api AS deploy
# This isolates the api package and installs ONLY its production
# dependencies (including local workspaces like @yourtable/shared)
RUN pnpm deploy --filter @yourtable/api --prod /deployed-api

# pnpm deploy respects .gitignore which excludes dist/, so copy it explicitly
RUN cp -r /app/packages/api/dist /deployed-api/dist

# Because pnpm deploy creates a fresh production node_modules folder,
# we need to regenerate the Prisma client inside this isolated environment
WORKDIR /deployed-api
RUN ./node_modules/.bin/prisma generate

# ──────────────────────────────────────────────
# Stage 7: Production runtime
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
# We don't need corepack or pnpm in the final image anymore!
RUN apk add --no-cache nginx

WORKDIR /app

# Copy the standalone API folder exactly to where start.sh expects it
COPY --from=deploy /deployed-api ./packages/api

# Copy the pre-built frontend static assets
COPY --from=build-web /app/packages/web/dist/ /var/www/web/
COPY --from=build-widget /app/packages/widget/dist/ /var/www/widget/

# Nginx setup
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Startup script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3001 80

CMD ["/app/start.sh"]