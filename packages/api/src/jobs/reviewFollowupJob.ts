import { sendReviewFollowups } from '../services/notificationService.js';

const REVIEW_FOLLOWUP_INTERVAL_MS = 30 * 60 * 1000; // every 30 min

let intervalId: NodeJS.Timeout | null = null;

export function startReviewFollowupJob() {
  console.log('[Cron] Review follow-up job started (every 30min)');
  runReviewFollowups();
  intervalId = setInterval(runReviewFollowups, REVIEW_FOLLOWUP_INTERVAL_MS);
}

export function stopReviewFollowupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Cron] Review follow-up job stopped');
  }
}

async function runReviewFollowups() {
  try {
    const sent = await sendReviewFollowups();
    if (sent > 0) {
      console.log(`[Cron] Sent ${sent} review follow-up notifications`);
    }
  } catch (error) {
    console.error('[Cron] Review follow-up job failed:', error);
  }
}
