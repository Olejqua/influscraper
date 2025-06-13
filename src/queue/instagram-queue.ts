import PQueue from 'p-queue';

import { config } from '../config';
import logger from '../utils/logger';

/**
 * Global queue for Instagram requests
 * Limits the number of concurrent browser sessions
 */
class InstagramQueue {
  private queue: PQueue;
  private stats = {
    totalProcessed: 0,
    totalErrors: 0,
    currentActive: 0,
    peakActive: 0,
  };

  constructor() {
    this.queue = new PQueue({
      concurrency: config.instagram.concurrency,
      interval: 60000, // 1 minute
      intervalCap: config.instagram.rateLimitPerMinute,
    });

    // Queue statistics logging
    this.queue.on('active', () => {
      this.stats.currentActive++;
      this.stats.peakActive = Math.max(this.stats.peakActive, this.stats.currentActive);

      logger.debug('Instagram queue: task started', {
        active: this.stats.currentActive,
        pending: this.queue.pending,
        size: this.queue.size,
      });
    });

    this.queue.on('completed', () => {
      this.stats.currentActive--;
      this.stats.totalProcessed++;

      logger.debug('Instagram queue: task completed', {
        active: this.stats.currentActive,
        pending: this.queue.pending,
        totalProcessed: this.stats.totalProcessed,
      });
    });

    this.queue.on('error', error => {
      this.stats.currentActive--;
      this.stats.totalErrors++;

      logger.error('Instagram queue: task failed', {
        error: error.message,
        active: this.stats.currentActive,
        pending: this.queue.pending,
        totalErrors: this.stats.totalErrors,
      });
    });

    // Periodic statistics logging
    setInterval(() => {
      if (this.queue.size > 0 || this.stats.currentActive > 0) {
        logger.info('Instagram queue stats', {
          ...this.stats,
          pending: this.queue.pending,
          size: this.queue.size,
        });
      }
    }, 30000); // every 30 seconds
  }

  /**
   * Adds a task to the queue
   */
  async add<T>(task: () => Promise<T>, options?: { priority?: number }): Promise<T> {
    const correlationId = Math.random().toString(36).substring(7);

    logger.debug('Instagram queue: adding task', {
      correlationId,
      queueSize: this.queue.size,
      pending: this.queue.pending,
      priority: options?.priority,
    });

    const result = await this.queue.add(async (): Promise<T> => {
      logger.debug('Instagram queue: executing task', { correlationId });
      const startTime = Date.now();

      try {
        const result = await task();
        const duration = Date.now() - startTime;

        logger.debug('Instagram queue: task success', {
          correlationId,
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Instagram queue: task error', {
          correlationId,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    }, options);

    return result as T;
  }

  /**
   * Returns current queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.queue.pending,
      size: this.queue.size,
      concurrency: this.queue.concurrency,
      intervalCap: config.instagram.rateLimitPerMinute,
    };
  }

  /**
   * Clears the queue and waits for active tasks to complete
   */
  async shutdown(): Promise<void> {
    logger.info('Instagram queue: shutting down', {
      pending: this.queue.pending,
      active: this.stats.currentActive,
    });

    this.queue.clear();
    await this.queue.onIdle();

    logger.info('Instagram queue: shutdown complete');
  }

  /**
   * Checks if there are any active or pending tasks
   */
  get isIdle(): boolean {
    return this.queue.size === 0 && this.stats.currentActive === 0;
  }
}

// Global singleton queue instance
export const instagramQueue = new InstagramQueue();

/**
 * Helper for executing Instagram tasks through the queue
 */
export async function executeInQueue<T>(task: () => Promise<T>, options?: { priority?: number }): Promise<T> {
  return instagramQueue.add(task, options);
}
