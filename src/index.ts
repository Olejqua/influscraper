import { Hono } from 'hono';

import { browserPool } from './browser/browser-pool';
import { instagramQueue } from './queue/instagram-queue';
import healthRouter from './routes/health';
import parseRouter from './routes/parse';
import logger from './utils/logger';

const app = new Hono();

// Routes
app.route('/', parseRouter);
app.route('/health', healthRouter);

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Stop Instagram queue
    logger.info('Shutting down Instagram queue...');
    await instagramQueue.shutdown();

    // Stop browser pool
    logger.info('Shutting down browser pool...');
    await browserPool.shutdown();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: promise.toString(),
  });
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });

  // Graceful shutdown on critical error
  gracefulShutdown('uncaughtException');
});

export default app;
