import app from './app.js';
import { startHoldCleanupJob } from './jobs/holdCleanup.js';
import { startReminderJob } from './jobs/reminderJob.js';
import { startWaitlistOfferJob } from './jobs/waitlistOfferJob.js';
import { startReviewFollowupJob } from './jobs/reviewFollowupJob.js';

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);

  if (process.env.JOBS_ENABLED !== 'false') {
    startHoldCleanupJob();
    startReminderJob();
    startWaitlistOfferJob();
    startReviewFollowupJob();
  } else {
    console.log('[Server] Background jobs disabled via JOBS_ENABLED=false');
  }
});
