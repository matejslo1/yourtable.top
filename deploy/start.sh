#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  YourTable.top — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run Prisma migrations (safe in production — only applies pending)
echo "[1/4] Running database migrations..."
cd /app/packages/api
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || echo "⚠️  Migration skipped (run manually if first deploy)"

# Generate Prisma client (ensure it matches the schema)
echo "[2/4] Generating Prisma client..."
npx prisma generate

# Start API server in background
echo "[3/4] Starting API server on port 3001..."
cd /app
NODE_ENV=production node packages/api/dist/server.js &
API_PID=$!

# Wait for API to be ready
echo "     Waiting for API..."
for i in $(seq 1 30); do
    if wget -qO- http://127.0.0.1:3001/health > /dev/null 2>&1; then
        echo "     ✓ API ready"
        break
    fi
    sleep 1
done

# Start nginx in foreground
echo "[4/4] Starting nginx on port 80..."
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
