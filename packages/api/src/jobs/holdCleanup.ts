import { cleanupExpiredHolds } from '../services/holdService.js';

const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the HOLD cleanup cron job
 * Runs every minute to expire stale HOLDs and free up tables
 */
export function startHoldCleanupJob() {
  console.log('[Cron] HOLD cleanup job started (every 60s)');

  // Run immediately on startup
  runCleanup();

  // Then every minute
  intervalId = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

export function stopHoldCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Cron] HOLD cleanup job stopped');
  }
}

async function runCleanup() {
  try {
    const count = await cleanupExpiredHolds();
    if (count > 0) {
      console.log(`[Cron] Cleaned up ${count} expired holds`);
    }
  } catch (error) {
    console.error('[Cron] HOLD cleanup failed:', error);
  }
}
