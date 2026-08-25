import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

async function main() {
  // Fail fast if DB is unreachable
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection OK');
  } catch (err) {
    logger.error('Cannot connect to database. Check DATABASE_URL and run migrations.', {
      err: (err as Error).message,
    });
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`DesertCart API listening on http://0.0.0.0:${config.port} (${config.env})`);
    logger.info(`Admin base path: ${config.adminBasePath} | Demo mode: ${config.demoMode}`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', { err: (err as Error).message });
  process.exit(1);
});

// Safety net: never crash the process on an unhandled rejection.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: (reason as Error)?.message });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
});
