import { Hono } from 'hono';
import { z } from 'zod';

import { instaScrape } from '../parsers/instagram';
import { tgScrape } from '../parsers/telegram';
import { getCache, setCache } from '../utils/cache';
import logger from '../utils/logger';
import { detectPlatform } from '../utils/platform';

const router = new Hono();

const parseSchema = z.object({
  url: z.string().url(),
  proxy: z.string().optional(),
});

router.post('/parse', async c => {
  const body = await c.req.json().catch(() => null);
  const parsed = parseSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn({ body }, 'Invalid request');
    return c.json({ error: 'Invalid request', code: 'INVALID_REQUEST' }, 400);
  }
  const { url, proxy } = parsed.data;
  const platform = detectPlatform(url);
  if (!platform) {
    logger.warn({ url }, 'Unsupported platform');
    return c.json({ error: 'Unsupported platform', code: 'UNSUPPORTED_PLATFORM' }, 400);
  }
  let nickname = '';
  if (platform === 'telegram') {
    nickname = url.replace(/^https:\/\/t\.me\//, '');
  } else if (platform === 'instagram') {
    nickname = url.replace(/^https:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  }
  const cacheKey = `cache:${platform}:${nickname}`;
  const start = Date.now();
  let source = 'scrape';
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      source = 'cache';
      logger.info({ platform, url, source, status: 'ok', duration: Date.now() - start }, 'Served from cache');
      return c.json(cached);
    }
    let result;
    if (platform === 'telegram') {
      result = await tgScrape(url);
    } else if (platform === 'instagram') {
      result = await instaScrape(url, proxy ? { proxy } : undefined);
    }
    await setCache(cacheKey, result);
    logger.info({ platform, url, source, status: 'ok', duration: Date.now() - start }, 'Scraped and cached');
    return c.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(
      { platform, url, source, status: 'error', duration: Date.now() - start, error: errorMessage },
      'Parse error',
    );
    return c.json({ error: errorMessage ?? 'Parse error', code: 'PARSE_ERROR' }, 422);
  }
});

export default router;
