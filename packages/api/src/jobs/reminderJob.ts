import { sendReminderEmails } from '../services/notificationService.js';

const REMINDER_INTERVAL_MS = 15 * 60 * 1000; // Check every 15min

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start reminder cron job
 * Checks hourly, sends reminders for tomorrow's reservations
 */
export function startReminderJob() {
  console.log('[Cron] Reminder job started (every 15min)');

  // Run once on startup
  runReminders();

  intervalId = setInterval(runReminders, REMINDER_INTERVAL_MS);
}

export function stopReminderJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Cron] Reminder job stopped');
  }
}

async function runReminders() {
  try {
    const sent = await sendReminderEmails();
    if (sent > 0) {
      console.log(`[Cron] Sent ${sent} reminders`);
    }
  } catch (error) {
    console.error('[Cron] Reminder job failed:', error);
  }
}
