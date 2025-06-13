/**
 * Centralized application configuration
 */

export interface AppConfig {
  redis: {
    url: string;
  };
  instagram: {
    concurrency: number;
    timeoutPageLoad: number;
    timeoutSelector: number;
    retryAttempts: number;
    rateLimitPerMinute: number;
  };
  browser: {
    poolSize: number;
    idleTimeout: number;
    launchTimeout: number;
  };
  logging: {
    level: string;
    fileEnabled: boolean;
    filePath: string;
  };
  healthCheck: {
    enabled: boolean;
    browserTest: boolean;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Loads configuration from environment variables with default values
 */
export function loadConfig(): AppConfig {
  return {
    redis: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
    instagram: {
      concurrency: parseInt(process.env.INSTAGRAM_CONCURRENCY ?? '2'),
      timeoutPageLoad: parseInt(process.env.INSTAGRAM_TIMEOUT_PAGE_LOAD ?? '20000'),
      timeoutSelector: parseInt(process.env.INSTAGRAM_TIMEOUT_SELECTOR ?? '15000'),
      retryAttempts: parseInt(process.env.INSTAGRAM_RETRY_ATTEMPTS ?? '2'),
      rateLimitPerMinute: parseInt(process.env.INSTAGRAM_RATE_LIMIT_PER_MINUTE ?? '30'),
    },
    browser: {
      poolSize: parseInt(process.env.BROWSER_POOL_SIZE ?? '3'),
      idleTimeout: parseInt(process.env.BROWSER_IDLE_TIMEOUT ?? '300000'),
      launchTimeout: parseInt(process.env.BROWSER_LAUNCH_TIMEOUT ?? '30000'),
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
      fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
      filePath: process.env.LOG_FILE_PATH ?? './logs/app.log',
    },
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      browserTest: process.env.HEALTH_CHECK_BROWSER_TEST !== 'false',
    },
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100'),
    },
  };
}

export const config = loadConfig();
