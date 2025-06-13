# 🧰 Project Tech Stack

## Core Stack

| Purpose                 | Technology / Library                       |
| ----------------------- | ------------------------------------------ |
| Development Language    | TypeScript                                 |
| Runtime/PM              | Bun (primary), compatible with Node.js     |
| HTTP Server             | Hono                                       |
| Instagram Parsing       | Playwright (Chromium)                      |
| Telegram Parsing        | cheerio (HTML parser)                      |
| Caching                 | Redis + ioredis                            |
| Request Queue           | p-queue                                    |
| Input Data Validation   | zod                                        |
| Logging                 | pino                                       |
| Playwright Docker Image | mcr.microsoft.com/playwright:v1.53.0-jammy |
| Docker Orchestration    | Docker Compose                             |
| Proxy (architectural)   | Built-in support via Playwright proxy API  |

---

## 🧪 Testing and Development

| Purpose                       | Technology                 |
| ----------------------------- | -------------------------- |
| Unit/Integration Tests        | vitest or jest (optional)  |
| Type System                   | TypeScript + tsconfig.json |
| JSON Type Validation          | Zod (z.object(...))        |
| HTTP Client (for tests, opt.) | undici or axios            |
| Linters/Formatter             | eslint, prettier           |

---

## 🧱 Architecture and Project Structure

| Layer         | Technology / Convention                              |
| ------------- | ---------------------------------------------------- |
| Modularity    | Each parser is a separate file in src/parsers/       |
| Interfaces    | Type Scraper = (url: string) => Promise<ProfileData> |
| Extensibility | Adding new module file                               |
| Configuration | .env for Redis URL, default proxy                    |

---

## ⚙️ DevOps / Environment

| Component       | Technology                           |
| --------------- | ------------------------------------ |
| Redis for Cache | redis:alpine in docker-compose.yml   |
| CI (optional)   | GitHub Actions (planned)             |
| Documentation   | README.md, optionally zod-to-openapi |

---

## 🚀 Commands (Bun)

- Install dependencies: `bun install`
- Run dev: `bun run src/index.ts`
- Tests: `bun test`
- Build/run in Docker: `docker compose up --build`
