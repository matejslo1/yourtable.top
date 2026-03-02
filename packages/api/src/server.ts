import app from './app.js';
import { prisma } from './utils/prisma.js';
import { startHoldCleanupJob, stopHoldCleanupJob } from './jobs/holdCleanup.js';
import { startReminderJob, stopReminderJob } from './jobs/reminderJob.js';
import { startVoucherExpiryJob, stopVoucherExpiryJob } from './jobs/voucherExpiryJob.js';
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
  startReminderJob();
  startVoucherExpiryJob();

  // Waitlist offer cleanup (every 5 minutes)
  waitlistIntervalId = setInterval(async () => {
    try { await cleanupExpiredOffers(); } catch (e) { console.error('[Cron] Waitlist cleanup failed:', e); }
  }, 5 * 60 * 1000);
  console.log('[Cron] Waitlist offer cleanup started (every 5min)');

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║  🍽️  YourTable API Server                          ║
║  Running on http://localhost:${PORT}                  ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(35)}║
║  Phase: 6 (Gift Vouchers)                         ║
║                                                   ║
║  Cron jobs:                                       ║
║    • HOLD cleanup      (every 60s)                ║
║    • Reminder emails   (every 60min)              ║
║    • Waitlist cleanup  (every 5min)               ║
║    • Voucher expiry    (every 6h)                 ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

async function shutdown() {
  console.log('[Server] Shutting down...');
  stopHoldCleanupJob();
  stopReminderJob();
  stopVoucherExpiryJob();
  if (waitlistIntervalId) clearInterval(waitlistIntervalId);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
