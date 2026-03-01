import app from './app.js';
import { prisma } from './utils/prisma.js';
import { startHoldCleanupJob, stopHoldCleanupJob } from './jobs/holdCleanup.js';
import { cleanupExpiredOffers } from './services/waitlistService.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

let waitlistIntervalId: NodeJS.Timeout | null = null;

async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    process.exit(1);
  }

  // Start background jobs
  startHoldCleanupJob();

  // Waitlist offer cleanup (every 5 minutes)
  waitlistIntervalId = setInterval(async () => {
    try {
      await cleanupExpiredOffers();
    } catch (error) {
      console.error('[Cron] Waitlist cleanup failed:', error);
    }
  }, 5 * 60 * 1000);
  console.log('[Cron] Waitlist offer cleanup started (every 5min)');

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  🍽️  YourTable API Server                     ║
║  Running on http://localhost:${PORT}             ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║  Phase: 3 (Reservations + Guests + Waitlist) ║
╚══════════════════════════════════════════════╝
    `);
  });
}

async function shutdown() {
  console.log('[Server] Shutting down...');
  stopHoldCleanupJob();
  if (waitlistIntervalId) clearInterval(waitlistIntervalId);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
