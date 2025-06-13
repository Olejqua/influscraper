// Platform detection utility will be implemented here

export type SupportedPlatform = 'instagram' | 'telegram';

export function detectPlatform(url: string): SupportedPlatform | null {
  try {
    const { hostname } = new URL(url);
    if (hostname.endsWith('instagram.com')) return 'instagram';
    if (hostname === 't.me') return 'telegram';
    return null;
  } catch {
    return null;
  }
}
