FROM mcr.microsoft.com/playwright:v1.53.0-jammy

RUN apt-get update && apt-get install -y unzip curl

# Установка Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY . .

RUN bun install --production

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"] 