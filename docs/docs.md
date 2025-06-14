📘 Техническое задание

Микросервис парсинга публичных профилей Instagram и Telegram

(v1 MVP)

⸻

🎯 Цель

Разработать микросервис на TypeScript, который принимает ссылку на публичный профиль Instagram или Telegram, определяет платформу, и запускает соответствующий парсер. Возвращает JSON с публичными данными: никнейм, имя, описание и аватар.
Сервис должен быть модульным, легко масштабируемым на новые платформы, с кэшированием, защитой от блокировок, поддержкой прокси (архитектурно) и минимальной латентностью.

⸻

📌 Поддерживаемые платформы

Платформа URL-пример Парсинг
Instagram https://www.instagram.com/user/ Playwright (браузер)
Telegram https://t.me/channel HTTP + Cheerio

⸻

📥 Запрос

POST /parse

{
"url": "https://t.me/example_channel"
}

⚙️ Позже (архитектурно):

{
"url": "https://instagram.com/...",
"proxy": "http://user:pass@proxy.example.com:8000"
}

⸻

📤 Ответ

200 OK

{
"platform": "telegram",
"nickname": "example_channel",
"fullName": "Название канала",
"bio": "Описание профиля",
"avatarUrl": "https://cdn4.telesco.pe/file/..."
}

Ошибки

Код Причина
400 URL невалиден или не поддерживается
422 Ошибка парсинга (403/429/DOM timeout и др.)

⸻

🧠 Логика работы

1. Определение платформы
   • На основе hostname (instagram.com, t.me) определяется платформа.
   • Маппинг вида:

const PLATFORM_PARSERS = {
instagram: instaScrape,
telegram: tgScrape
}

    •	Если платформа не поддерживается — возвращается 400.

⸻

2. Парсеры: модульная архитектура

Каждая платформа реализуется как отдельный модуль со стандартным интерфейсом:

type ScrapeResult = {
platform: string;
nickname: string;
fullName: string;
bio: string;
avatarUrl: string;
};

type Scraper = (url: string, options?: ScrapeOptions) => Promise<ScrapeResult>;

🔹 src/parsers/instagram.ts
• Использует Playwright
• Эмулирует поведение человека (user-agent, задержки)
• Ожидает DOM-элементы, извлекает данные
• Запускается с возможностью прокси

🔹 src/parsers/telegram.ts
• Не использует браузер
• HTTP GET https://t.me/channel
• Использует cheerio для извлечения <meta>-тегов:
• og:title → fullName
• og:description → bio
• og:image → avatarUrl

⸻

🔌 Прокси
• Для Instagram поддерживается опциональный параметр proxy, передаваемый в launch() Playwright:

proxy ? { server: proxy } : undefined

    •	Telegram-прокси на этапе MVP не требуется (HTTP GET).

⸻

🧊 Кэширование
• Используется Redis.
• Ключ: cache:<platform>:<nickname>
• TTL: 24 часа
• При повторном запросе результат отдаётся из кэша.

⸻

🚦 Контроль нагрузки
• Используется p-queue
• Максимум 5 параллельных сессий Playwright
• Telegram-запросы не учитываются в очереди (не нагружают браузер)

⸻

🪵 Логгирование
• Формат логов: JSON через pino
• Логируются:
• platform, url, duration, source (cache / scrape), status
• ошибки (в отдельном уровне)

⸻

📦 Структура проекта

📁 src
├── routes/
│ └── parse.ts // POST /parse
├── parsers/
│ ├── instagram.ts // Playwright-скрапер
│ └── telegram.ts // Cheerio-скрапер
├── utils/
│ ├── platform.ts // Определение платформы
│ ├── cache.ts // Redis
│ └── logger.ts // Pino логгер
├── index.ts // Инициализация Hono API
📁 docker/
├── Dockerfile
└── docker-compose.yml

⸻

🐳 Docker

Dockerfile

FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "run", "start"]

docker-compose.yml

version: '3.8'
services:
scraper:
build: .
ports: - "3000:3000"
environment: - REDIS_URL=redis://redis:6379
depends_on: - redis
redis:
image: redis:alpine
ports: - "6379:6379"

⸻

📈 Пропускная способность (ориентировочно)

Тип запроса Скорость обработки
Instagram ~15–20 профилей/минуту на 1 ядро
Telegram ~100–300 профилей/минуту
С кешем 500+ запросов/минуту

⸻

✅ Требования к реализации
• Модули парсинга платформ независимы
• Сервис может быть расширен добавлением нового парсера в src/parsers/\*.ts
• Парсеры реализуют единый интерфейс
• Поддержка прокси заложена архитектурно
• Telegram реализован без браузера

⸻
