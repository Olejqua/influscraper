import { Hono } from 'hono';

import { browserPool } from '../browser/browser-pool';
import { config } from '../config';
import { instagramQueue } from '../queue/instagram-queue';
import { setCache, getCache } from '../utils/cache';
import logger from '../utils/logger';

const health = new Hono();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    redis: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    instagram_queue: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      stats: ReturnType<typeof instagramQueue.getStats>;
    };
    browser_pool: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      stats: ReturnType<typeof browserPool.getStats>;
    };
    playwright?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
      testDuration?: number;
    };
  };
}

/**
 * Redis health check
 */
async function checkRedisHealth(): Promise<HealthStatus['services']['redis']> {
  try {
    const startTime = Date.now();
    await setCache('health:check', 'ok', 10); // TTL 10 seconds
    const result = await getCache('health:check');
    const latency = Date.now() - startTime;

    if (result === 'ok') {
      return { status: 'healthy', latency };
    } else {
      return { status: 'unhealthy', error: 'Redis test failed' };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Instagram queue health check
 */
function checkInstagramQueueHealth(): HealthStatus['services']['instagram_queue'] {
  const stats = instagramQueue.getStats();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // If queue is too large, consider status degraded
  if (stats.pending > 10) {
    status = 'degraded';
  }

  // If too many errors, consider unhealthy
  if (stats.totalErrors > stats.totalProcessed * 0.5 && stats.totalProcessed > 0) {
    status = 'unhealthy';
  }

  return { status, stats };
}

/**
 * Browser pool health check
 */
function checkBrowserPoolHealth(): HealthStatus['services']['browser_pool'] {
  const stats = browserPool.getStats();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // If pool is full and all browsers are active, status is degraded
  if (stats.totalInstances >= stats.poolSize && stats.activeInstances === stats.totalInstances) {
    status = 'degraded';
  }

  // If pool is shutting down
  if (stats.isShuttingDown) {
    status = 'unhealthy';
  }

  return { status, stats };
}

/**
 * Browser test run (optional)
 */
async function checkPlaywrightHealth(): Promise<HealthStatus['services']['playwright']> {
  if (!config.healthCheck.browserTest) {
    return { status: 'healthy' };
  }

  try {
    const startTime = Date.now();

    // Simple test - create and close browser context
    const { instanceId } = await browserPool.getBrowserContext();
    await browserPool.releaseBrowserContext(instanceId);

    const testDuration = Date.now() - startTime;

    return { status: 'healthy', testDuration };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Determine overall service status
 */
function determineOverallStatus(services: HealthStatus['services']): HealthStatus['status'] {
  const statuses = [
    services.redis.status,
    services.instagram_queue.status,
    services.browser_pool.status,
    services.playwright?.status ?? 'healthy',
  ];

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * GET /health - main healthcheck
 */
health.get('/', async c => {
  const startTime = Date.now();

  try {
    logger.debug('Health check: starting');

    // Parallel check of all services
    const [redisHealth, playwrightHealth] = await Promise.allSettled([checkRedisHealth(), checkPlaywrightHealth()]);

    const services: HealthStatus['services'] = {
      redis:
        redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy', error: 'Health check failed' },
      instagram_queue: checkInstagramQueueHealth(),
      browser_pool: checkBrowserPoolHealth(),
    };

    if (playwrightHealth.status === 'fulfilled') {
      services.playwright = playwrightHealth.value;
    } else {
      services.playwright = {
        status: 'unhealthy',
        error: 'Playwright health check failed',
      };
    }

    const overallStatus = determineOverallStatus(services);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '1.0.0',
      services,
    };

    const duration = Date.now() - startTime;

    logger.info('Health check: completed', {
      status: overallStatus,
      duration,
    });

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return c.json(healthStatus, httpStatus);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Health check: failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version ?? '1.0.0',
        error: error instanceof Error ? error.message : String(error),
      },
      503,
    );
  }
});

/**
 * GET /health/ready - readiness probe
 */
health.get('/ready', async c => {
  try {
    // Quick readiness check of main components
    const redisHealth = await checkRedisHealth();
    const queueHealth = checkInstagramQueueHealth();
    const poolHealth = checkBrowserPoolHealth();

    const isReady =
      redisHealth.status === 'healthy' && queueHealth.status !== 'unhealthy' && poolHealth.status !== 'unhealthy';

    if (isReady) {
      return c.json({ status: 'ready' });
    } else {
      return c.json({ status: 'not ready' }, 503);
    }
  } catch (error) {
    return c.json(
      {
        status: 'not ready',
        error: error instanceof Error ? error.message : String(error),
      },
      503,
    );
  }
});

/**
 * GET /health/live - liveness probe
 */
health.get('/live', c => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default health;
