import app from './app.js';
import { prisma } from './utils/prisma.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║  🍽️  YourTable API Server                ║
║  Running on http://localhost:${PORT}        ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║
╚══════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
