#!/bin/bash
# ============================================
# YourTable.top — Quick Update
# ============================================
# Za hitro posodobitev po spremembi kode.
# Uporaba: sudo ./deploy/update.sh

set -e

APP_DIR="/opt/yourtable"
APP_USER="yourtable"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[Update]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
    echo "Zaženi kot root: sudo ./deploy/update.sh"
    exit 1
fi

log "Kopiram nove datoteke..."
rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.env' ./ "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Buildam..."
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR
    set -a; source .env; set +a
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    pnpm --filter @yourtable/shared build
    pnpm --filter @yourtable/api db:generate
    pnpm --filter @yourtable/api build
    pnpm --filter @yourtable/web build
    pnpm --filter @yourtable/widget build
"

log "Migriram bazo..."
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/packages/api
    set -a; source $APP_DIR/.env; set +a
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
"

log "Kopiram frontent builde..."
cp -r "$APP_DIR/packages/web/dist/"* /var/www/yourtable/web/
cp -r "$APP_DIR/packages/widget/dist/"* /var/www/yourtable/widget/
chown -R www-data:www-data /var/www/yourtable/

log "Restartiram API..."
sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    pm2 restart yourtable-api
"

systemctl reload nginx

log "✅ Update končan! pm2 logs yourtable-api za loge."
