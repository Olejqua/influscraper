# Instagram & Telegram Profile Scraper Microservice

> In development. See [docs/dev_plan.md](docs/dev_plan.md) for progress.

---

## 🐳 Dev Containers (VS Code)

For quick development and testing setup, use Dev Containers:

1. Install [VS Code](https://code.visualstudio.com/) and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.
2. Open the project in VS Code and select "Reopen in Container".
3. The container will automatically provide:
   - Bun
   - Redis (via docker-compose)
   - Playwright
   - All dependencies
4. To run tests and the application, use standard commands:
   ```sh
   bun install
   bun test
   bun run src/index.ts
   ```

> Dev Container automatically connects Redis service and sets up the development environment.

---

## 🚦 CI/CD

Tests are automatically run in GitHub Actions:

- Redis runs as a service
- Bun is installed via official action
- All tests are executed with `bun test`

To replicate CI locally:

1. Start Redis (see below)
2. Execute:
   ```sh
   bun install
   bun test
   ```

---

## 🚀 Quick Start (Bun + Docker)

### Requirements

- [Bun](https://bun.sh/) >= 1.0
- Docker, Docker Compose

### Running Redis for Development

**Option 1: Docker (recommended)**

```sh
docker run --name influscraper-redis -p 6379:6379 -d redis:alpine
```

**Option 2: Docker Compose**

```sh
docker compose up redis
```

**Option 3: Local Installation**

- Install Redis (e.g., `brew install redis`)
- Run: `redis-server`

Check availability:

```sh
redis-cli ping
# Expected: PONG
```

### Installing Dependencies

```sh
bun install
```

### Local Development Run

```sh
bun run src/index.ts
```

### Build and Run in Docker

```sh
docker compose up --build
```

### Tests

```sh
bun test
```

---

## 🧰 Technologies

- Bun (runtime + package manager)
- TypeScript
- Hono (HTTP API)
- Playwright (Instagram)
- Cheerio (Telegram)
- Redis + ioredis (cache)
- p-queue (queue)
- pino (logging)
- zod (validation)
- vitest/jest (tests)
- eslint, prettier (code quality)

---

## Notes

- All npm/yarn commands are replaced with `bun` (e.g., `bun install`, `bun run`, `bun test`).
- The project is compatible with Node.js, but the primary runtime is Bun.
- For running Playwright in Docker, the official image `mcr.microsoft.com/playwright:v1.53.0-jammy` is used.
