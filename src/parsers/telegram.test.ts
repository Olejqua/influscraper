import { describe, it, expect } from 'vitest';

import { tgScrape } from './telegram';

describe('tgScrape', () => {
  it('parses a real Telegram channel', async () => {
    const url = 'https://t.me/durov';
    const result = await tgScrape(url);
    expect(result.platform).toBe('telegram');
    expect(result.nickname).toBe('durov');
    expect(result.fullName.length).toBeGreaterThan(0);
    expect(result.avatarUrl).toMatch(/^https?:\/\//);
  });
});
