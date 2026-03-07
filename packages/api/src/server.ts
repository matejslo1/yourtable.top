import app from './app.js';
import { startHoldCleanupJob } from './jobs/holdCleanup.js';

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  // startHoldCleanupJob(); // ⛔ začasno izklopi
});
