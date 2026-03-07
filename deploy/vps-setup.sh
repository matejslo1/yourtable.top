#!/bin/bash
# ============================================
# YourTable.top — VPS Deploy Script
# ============================================
# Za Ubuntu 22/24 VPS (DigitalOcean, Hetzner, itd.)
#
# Uporaba:
#   1. scp yourtable-deploy.zip user@server:~/
#   2. ssh user@server
#   3. unzip yourtable-deploy.zip
#   4. cd yourtable-deploy
#   5. cp .env.example .env && nano .env  (izpolni)
#   6. chmod +x deploy/vps-setup.sh
#   7. sudo ./deploy/vps-setup.sh
#
# Po prvem setupu, za update:
#   sudo ./deploy/vps-setup.sh --update
# ============================================

set -e

APP_DIR="/opt/yourtable"
APP_USER="yourtable"
DOMAIN="${DOMAIN:-yourtable.top}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[YourTable]${NC} $1"; }
warn() { echo -e "${YELLOW}[Warning]${NC} $1"; }
err() { echo -e "${RED}[Error]${NC} $1"; exit 1; }

# ─── Check root ─────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "Zaženi kot root: sudo ./deploy/vps-setup.sh"
fi

# ─── Check .env exists ──────────────────────
if [ ! -f .env ]; then
    err ".env datoteka ne obstaja! Kopiraj .env.example v .env in izpolni vrednosti."
fi

UPDATE_ONLY=false
if [ "$1" == "--update" ]; then
    UPDATE_ONLY=true
    log "Update mode — preskoči sistemske pakete"
fi

# ─── Install system packages ────────────────
if [ "$UPDATE_ONLY" = false ]; then
    log "Nameščam sistemske pakete..."
    apt-get update -qq
    apt-get install -y -qq nginx certbot python3-certbot-nginx curl unzip

    # Node.js 20 LTS
    if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
        log "Nameščam Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    fi

    # pnpm
    if ! command -v pnpm &> /dev/null; then
        log "Nameščam pnpm..."
        npm install -g pnpm@9
    fi

    # PM2 za process management
    if ! command -v pm2 &> /dev/null; then
        log "Nameščam PM2..."
        npm install -g pm2
    fi

    # Create app user
    if ! id "$APP_USER" &>/dev/null; then
        log "Ustvarjam uporabnika $APP_USER..."
        useradd -r -m -s /bin/bash "$APP_USER"
    fi
fi

# ─── Copy app files ─────────────────────────
log "Kopiram datoteke v $APP_DIR..."
mkdir -p "$APP_DIR"
rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' ./ "$APP_DIR/"
cp .env "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ─── Install deps & build ───────────────────
log "Nameščam odvisnosti in buildam..."
cd "$APP_DIR"
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR
    export PATH=/usr/bin:\$PATH

    # Install
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

    # Load env for build
    set -a; source .env; set +a

    # Build shared first
    pnpm --filter @yourtable/shared build

    # Generate Prisma client
    pnpm --filter @yourtable/api db:generate

    # Build API
    pnpm --filter @yourtable/api build

    # Build frontend (needs VITE_ env vars)
    pnpm --filter @yourtable/web build

    # Build widget
    pnpm --filter @yourtable/widget build
"

# ─── Database migration ─────────────────────
log "Migriram bazo..."
cd "$APP_DIR"
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/packages/api
    set -a; source $APP_DIR/.env; set +a
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
"

# ─── Copy frontend builds to nginx ──────────
log "Kopiram frontend builde..."
mkdir -p /var/www/yourtable/web
mkdir -p /var/www/yourtable/widget
cp -r "$APP_DIR/packages/web/dist/"* /var/www/yourtable/web/
cp -r "$APP_DIR/packages/widget/dist/"* /var/www/yourtable/widget/
chown -R www-data:www-data /var/www/yourtable/

# ─── Nginx config ───────────────────────────
log "Nastavljam nginx..."
cat > /etc/nginx/sites-available/yourtable << NGINX_CONF
server {
    listen 80;
    server_name $DOMAIN app.$DOMAIN api.$DOMAIN;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
    gzip_vary on;

    # Security
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # Health
    location /health {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
    }

    # Widget (CORS enabled for embedding)
    location /widget/ {
        alias /var/www/yourtable/widget/;
        expires 1h;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        try_files \$uri =404;
    }

    # Admin SPA
    location / {
        root /var/www/yourtable/web;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX_CONF

# Enable site
ln -sf /etc/nginx/sites-available/yourtable /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ─── PM2 — start API ────────────────────────
log "Zaganjam API z PM2..."

# Create PM2 ecosystem file
cat > "$APP_DIR/ecosystem.config.cjs" << 'PM2_CONF'
module.exports = {
  apps: [{
    name: 'yourtable-api',
    cwd: '/opt/yourtable/packages/api',
    script: 'dist/server.js',
    node_args: '--experimental-specifier-resolution=node',
    env_file: '/opt/yourtable/.env',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/yourtable/error.log',
    out_file: '/var/log/yourtable/out.log',
  }]
};
PM2_CONF

mkdir -p /var/log/yourtable
chown -R "$APP_USER:$APP_USER" /var/log/yourtable

# Stop existing if running
sudo -u "$APP_USER" pm2 delete yourtable-api 2>/dev/null || true

# Start
sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    pm2 start ecosystem.config.cjs
    pm2 save
"

# Auto-start on reboot
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true

# ─── SSL (certbot) ──────────────────────────
if [ "$UPDATE_ONLY" = false ]; then
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "  ✅ YourTable.top je nameščen!"
    log ""
    log "  🌐 Admin:   http://$DOMAIN"
    log "  🔌 API:     http://$DOMAIN/api/v1"
    log "  📦 Widget:  http://$DOMAIN/widget/widget.iife.js"
    log "  💚 Health:  http://$DOMAIN/health"
    log ""
    log "  Za SSL certifikat zaženi:"
    log "  sudo certbot --nginx -d $DOMAIN"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "  ✅ Update uspešen!"
    log "  PM2 status: pm2 status"
    log "  Logi: pm2 logs yourtable-api"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
