import type { BrowserContext, Page } from 'playwright';

import { withBrowserContext } from '../browser/browser-pool';
import { config } from '../config';
import { executeInQueue } from '../queue/instagram-queue';
import type { ScrapeResult } from '../types';
import logger from '../utils/logger';

/**
 * Correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return Math.random().toString(36).substring(7);
}

/**
 * Retry logic for recovery after failures
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = config.instagram.retryAttempts,
  correlationId: string,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug('Instagram scrape: attempting operation', {
        correlationId,
        attempt,
        maxAttempts,
      });

      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn('Instagram scrape: operation failed, retrying', {
        correlationId,
        attempt,
        maxAttempts,
        error: lastError.message,
      });

      if (attempt < maxAttempts) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Main Instagram profile scraping function
 */
async function scrapeInstagramProfile(
  context: BrowserContext,
  url: string,
  correlationId: string,
): Promise<ScrapeResult> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    logger.info('Instagram scrape: starting profile scrape', {
      correlationId,
      url,
    });

    page = await context.newPage();

    // Page setup
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Navigate to page with retry logic
    await withRetry(
      async () => {
        await page!.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: config.instagram.timeoutPageLoad,
        });
      },
      2,
      correlationId,
    );

    // Random delay to mimic human behavior
    const randomDelay = 1000 + Math.random() * 2000;
    await page.waitForTimeout(randomDelay);

    // Wait for main content to load
    await withRetry(
      async () => {
        await page!.waitForSelector('header', {
          timeout: config.instagram.timeoutSelector,
        });
      },
      2,
      correlationId,
    );

    logger.debug('Instagram scrape: page loaded successfully', {
      correlationId,
      loadTime: Date.now() - startTime,
    });

    // Extract data from DOM
    const result = await page.evaluate(() => {
      const nickname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');

      const fullName = document.querySelector('header h1, header h2')?.textContent?.trim() ?? '';

      const bio =
        document
          .querySelector('header section > div > h1, header section > div > span, header section ul + div')
          ?.textContent?.trim() ?? '';

      const avatarUrl = (document.querySelector('header img') as HTMLImageElement)?.src ?? '';

      return { nickname, fullName, bio, avatarUrl };
    });

    const totalTime = Date.now() - startTime;

    logger.info('Instagram scrape: profile scraped successfully', {
      correlationId,
      nickname: result.nickname,
      totalTime,
    });

    return {
      platform: 'instagram',
      ...result,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Instagram scrape: profile scrape failed', {
      correlationId,
      url,
      totalTime,
      error: errorMessage,
    });

    throw new Error(`Instagram scrape failed: ${errorMessage}`);
  } finally {
    if (page) {
      try {
        await page.close();
        logger.debug('Instagram scrape: page closed', { correlationId });
      } catch (error) {
        logger.warn('Instagram scrape: error closing page', {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * Public function for Instagram profile scraping
 * Uses global queue and browser pool
 */
export async function instaScrape(url: string, options?: { proxy?: string }): Promise<ScrapeResult> {
  const correlationId = generateCorrelationId();

  logger.info('Instagram scrape: request received', {
    correlationId,
    url,
    proxy: !!options?.proxy,
  });

  // Execute scraping through global queue
  return executeInQueue(async () => {
    return withBrowserContext(async context => {
      return scrapeInstagramProfile(context, url, correlationId);
    }, options?.proxy);
  });
}
