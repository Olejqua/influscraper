export type ScrapeResult = {
  platform: string;
  nickname: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
};

export type Scraper = (url: string, options?: Record<string, unknown>) => Promise<ScrapeResult>;
