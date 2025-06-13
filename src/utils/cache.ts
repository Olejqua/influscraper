import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
export const redis = new Redis(redisUrl);

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? (JSON.parse(data) as T) : null;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 86400): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}
