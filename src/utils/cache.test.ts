import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { getCache, setCache, redis } from './cache';

describe('cache utils', () => {
  const key = 'test:key';
  const value = { foo: 'bar' };

  beforeAll(async () => {
    await redis.del(key);
  });

  afterAll(async () => {
    await redis.del(key);
    redis.disconnect();
  });

  it('setCache and getCache', async () => {
    await setCache(key, value, 10);
    const cached = await getCache<typeof value>(key);
    expect(cached).toEqual(value);
  });

  it('returns null for missing key', async () => {
    await redis.del(key);
    const cached = await getCache(key);
    expect(cached).toBeNull();
  });
});
