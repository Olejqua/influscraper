import { describe, it, expect, afterAll } from 'vitest';

import { browserPool } from '../browser/browser-pool';
import { instagramQueue } from '../queue/instagram-queue';

import { instaScrape } from './instagram';

describe('Instagram Parser', () => {
  afterAll(async () => {
    // Graceful shutdown after tests
    await instagramQueue.shutdown();
    await browserPool.shutdown();
  });

  it('should scrape Instagram profile successfully', async () => {
    const testUrl = 'https://www.instagram.com/instagram/';

    const result = await instaScrape(testUrl);

    expect(result).toBeDefined();
    expect(result.platform).toBe('instagram');
    expect(result.nickname).toBe('instagram');
    expect(typeof result.fullName).toBe('string');
    expect(typeof result.bio).toBe('string');
    expect(typeof result.avatarUrl).toBe('string');
  }, 30000);
});
