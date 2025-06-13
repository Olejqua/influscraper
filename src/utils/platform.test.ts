import { describe, it, expect } from 'vitest';

import { detectPlatform } from './platform';

describe('detectPlatform', () => {
  it('detects instagram', () => {
    expect(detectPlatform('https://instagram.com/user')).toBe('instagram');
    expect(detectPlatform('https://www.instagram.com/user/')).toBe('instagram');
  });
  it('detects telegram', () => {
    expect(detectPlatform('https://t.me/channel')).toBe('telegram');
  });
  it('returns null for unsupported', () => {
    expect(detectPlatform('https://twitter.com/user')).toBeNull();
    expect(detectPlatform('not a url')).toBeNull();
  });
});
