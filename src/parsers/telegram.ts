import * as cheerio from 'cheerio';
import { request } from 'undici';

import type { ScrapeResult } from '../types';

export async function tgScrape(url: string): Promise<ScrapeResult> {
  const { body, statusCode } = await request(url);
  if (statusCode !== 200) {
    throw new Error(`Failed to fetch Telegram page: ${statusCode}`);
  }
  const html = await body.text();
  const $ = cheerio.load(html);
  const fullName = $('meta[property="og:title"]').attr('content') ?? '';
  const bio = $('meta[property="og:description"]').attr('content') ?? '';
  const avatarUrl = $('meta[property="og:image"]').attr('content') ?? '';
  const nickname = url.replace(/^https:\/\/t\.me\//, '');
  return {
    platform: 'telegram',
    nickname,
    fullName,
    bio,
    avatarUrl,
  };
}
