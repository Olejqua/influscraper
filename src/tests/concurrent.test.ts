import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { browserPool } from '../browser/browser-pool';
import { instaScrape } from '../parsers/instagram';
import { instagramQueue } from '../queue/instagram-queue';
import type { ScrapeResult } from '../types';

// Type guard to check if result is a ScrapeResult
function isScrapeResult(result: any): result is ScrapeResult {
  return result && typeof result === 'object' && 'platform' in result && !('error' in result);
}

describe('Instagram Parser Concurrent Tests', () => {
  const testUrl = 'https://www.instagram.com/instagram/';

  beforeAll(async () => {
    // Give time for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Graceful shutdown after tests
    await instagramQueue.shutdown();
    await browserPool.shutdown();
  });

  it('should handle single Instagram request', async () => {
    const result = await instaScrape(testUrl);

    expect(result).toBeDefined();
    expect(result.platform).toBe('instagram');
    expect(result.nickname).toBe('instagram');
    expect(typeof result.fullName).toBe('string');
    expect(typeof result.bio).toBe('string');
    expect(typeof result.avatarUrl).toBe('string');
  }, 30000);

  it('should handle 3 concurrent Instagram requests', async () => {
    const promises = Array(3)
      .fill(null)
      .map(() => instaScrape(testUrl));

    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.platform).toBe('instagram');
      expect(result.nickname).toBe('instagram');
    });
  }, 60000);

  it('should handle 5 concurrent Instagram requests', async () => {
    const promises = Array(5)
      .fill(null)
      .map(() => instaScrape(testUrl));

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.platform).toBe('instagram');
      expect(result.nickname).toBe('instagram');
    });
  }, 90000);

  it('should handle mixed success and failure scenarios', async () => {
    const validUrl = testUrl;
    const invalidUrl = 'https://www.instagram.com/nonexistentuser12345678901234567890/';

    const promises = [
      instaScrape(validUrl),
      instaScrape(invalidUrl).catch(err => ({ error: err.message })),
      instaScrape(validUrl),
      instaScrape(invalidUrl).catch(err => ({ error: err.message })),
      instaScrape(validUrl),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);

    // Check successful results using type guard
    const successResults = results.filter(isScrapeResult);
    expect(successResults.length).toBeGreaterThan(0);

    successResults.forEach(result => {
      expect(result.platform).toBe('instagram');
      expect(result.nickname).toBe('instagram');
    });
  }, 120000);

  it('should maintain queue statistics correctly', async () => {
    const initialStats = instagramQueue.getStats();

    // Run several tasks
    const promises = Array(3)
      .fill(null)
      .map(() => instaScrape(testUrl));

    // Check statistics during execution
    const duringStats = instagramQueue.getStats();
    expect(duringStats.totalProcessed).toBeGreaterThanOrEqual(initialStats.totalProcessed);

    await Promise.all(promises);

    // Check final statistics
    const finalStats = instagramQueue.getStats();
    expect(finalStats.totalProcessed).toBe(initialStats.totalProcessed + 3);
  }, 60000);

  it('should maintain browser pool statistics correctly', async () => {
    // Get initial stats
    const finalStats = browserPool.getStats();

    // Run tasks
    const promises = Array(2)
      .fill(null)
      .map(() => instaScrape(testUrl));

    await Promise.all(promises);

    // Check that pool works correctly
    expect(finalStats.totalInstances).toBeLessThanOrEqual(finalStats.poolSize);
    expect(finalStats.activeInstances).toBeLessThanOrEqual(finalStats.totalInstances);
  }, 60000);

  it('should handle rapid sequential requests', async () => {
    const results = [];

    // Sequential requests with minimal delay
    for (let i = 0; i < 3; i++) {
      const result = await instaScrape(testUrl);
      results.push(result);

      // Minimal delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.platform).toBe('instagram');
      expect(result.nickname).toBe('instagram');
    });
  }, 90000);

  it('should handle queue overflow gracefully', async () => {
    // Create more requests than the queue can handle simultaneously
    const promises = Array(10)
      .fill(null)
      .map((_, index) =>
        instaScrape(testUrl).catch(err => ({
          error: err.message,
          index,
        })),
      );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);

    // Check that at least some requests are successful
    const successResults = results.filter(r => !('error' in r));
    expect(successResults.length).toBeGreaterThan(0);
  }, 180000);

  it('should recover from browser crashes', async () => {
    // First successful request
    const result1 = await instaScrape(testUrl);
    expect(result1.platform).toBe('instagram');

    // Force clear browser pool (crash simulation)
    await browserPool.shutdown();

    // Give time for recovery
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second request should create new browser
    const result2 = await instaScrape(testUrl);
    expect(result2.platform).toBe('instagram');
  }, 60000);
});
