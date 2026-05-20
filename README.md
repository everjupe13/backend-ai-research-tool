# AI Research Tool — Backend

NestJS backend для AI-powered инструмента исследований. Принимает тему, ищет по OpenSearch, суммаризирует через AI и сохраняет отчёты в PostgreSQL.

## Требования

- Node.js 20+
- Docker & Docker Compose

## Запуск локально

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

Скопировать `.env.example` в `.env` и заполнить значения:

```bash
cp .env.example .env
```

Минимальный набор для локального запуска:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://research:research@localhost:5432/research
```

### 3. Поднять инфраструктуру (PostgreSQL)

```bash
docker compose up -d
```

Проверить что контейнеры запустились:

```bash
docker compose ps
```

### 4. Применить миграции

```bash
npm run migration:run
```

### 5. Запустить приложение

```bash
# dev режим с hot reload
npm run start:dev

# или обычный запуск
npm run start
```

Приложение будет доступно на `http://localhost:8082`.

## Скрипты

### Приложение

```bash
npm run start:dev        # Dev режим с hot reload
npm run build            # Сборка TypeScript
npm run start:prod       # Запуск собранного приложения
```

### Тесты

```bash
npm test                 # Unit-тесты
npm run test:e2e         # E2E-тесты
npm run test:cov         # Покрытие тестами
```

### Миграции

```bash
# Сгенерировать новую миграцию на основе изменений в entity-файлах.
# Передать имя миграции как аргумент.
npm run migration:generate src/database/migrations/ИмяМиграции

# Применить все непримененные миграции к БД
npm run migration:run

# Откатить последнюю применённую миграцию
npm run migration:revert

# Показать список миграций и статус каждой (applied / pending)
npm run migration:show
```

> Миграции хранятся в `src/database/migrations/`. Никогда не менять схему БД вручную — только через миграции.

## Документация

| Файл | Содержимое |
|------|-----------|
| [docs/entities.md](docs/entities.md) | Все сущности БД: таблицы, колонки, связи, enum-значения |
| [docs/ai-module.md](docs/ai-module.md) | AI-модуль (Anthropic/OpenAI, prompt caching, streaming) и rate limiting — включая чеклист для продакшена |
| [CLAUDE.md](CLAUDE.md) | Полное описание архитектуры проекта для AI-ассистентов |

---

## Остановка инфраструктуры

```bash
docker compose down
```

Удалить данные (volumes):

```bash
docker compose down -v
```
