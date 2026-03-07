#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  YourTable.top — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run Prisma migrations with a timeout so it never hangs
echo "[1/4] Running database migrations..."
cd /app/packages/api
timeout 30 ./node_modules/.bin/prisma migrate deploy || echo "⚠️  Migration skipped or timed out — continuing"

# Start API server in background
echo "[2/4] Starting API server on port 3001..."
cd /app
NODE_ENV=production node packages/api/dist/server.js &
API_PID=$!

# Wait for API to be ready (max 20s)
echo "     Waiting for API..."
for i in $(seq 1 20); do
    if wget -qO- http://127.0.0.1:3001/health > /dev/null 2>&1; then
        echo "     ✓ API ready after ${i}s"
        break
    fi
    sleep 1
done

# Auto-create superadmin if env vars are set
if [ -n "$SUPERADMIN_EMAIL" ] && [ -n "$SUPERADMIN_PASSWORD" ] && [ -n "$SUPERADMIN_NAME" ] && [ -n "$SETUP_SECRET" ]; then
    echo "[2b] Creating superadmin if not exists..."
    RESULT=$(wget -qO- --post-data="{\"email\":\"${SUPERADMIN_EMAIL}\",\"password\":\"${SUPERADMIN_PASSWORD}\",\"name\":\"${SUPERADMIN_NAME}\"}" \
        --header="Content-Type: application/json" \
        --header="x-setup-secret: ${SETUP_SECRET}" \
        http://127.0.0.1:3001/api/v1/setup/superadmin 2>&1 || true)
    echo "     Superadmin: ${RESULT}"
fi

# Inject Railway's PORT into nginx config (defaults to 80)
sed -i "s/__PORT__/${PORT:-80}/" /etc/nginx/http.d/default.conf

# Start nginx in foreground
echo "[3/4] Starting nginx on port ${PORT:-80}..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ YourTable.top is running!"
echo "    Admin:  http://localhost"
echo "    API:    http://localhost/api/v1"
echo "    Widget: http://localhost/widget/"
echo "    Health: http://localhost/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Trap signals for graceful shutdown
trap "kill $API_PID 2>/dev/null; nginx -s quit 2>/dev/null; exit 0" SIGTERM SIGINT

nginx -g "daemon off;" &
NGINX_PID=$!

# Wait for either process to exit
wait $API_PID $NGINX_PID
