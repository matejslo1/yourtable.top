import app from './app.js';
import { startHoldCleanupJob } from './jobs/holdCleanup.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  startHoldCleanupJob();
});
