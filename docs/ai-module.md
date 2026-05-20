# AI Module

Модуль отвечает за генерацию текстовых саммари по теме исследования.
Расположен в `src/modules/ai/`.

## Структура

```
src/modules/ai/
├── ai.service.ts   # Логика вызова AI-провайдеров
└── ai.module.ts    # NestJS-модуль, экспортирует AiService
```

## AiService

Единственный публичный метод:

```typescript
summarize(topic: string, sources: string[]): Promise<string>
```

- `topic` — тема исследования (передаётся из `ResearchJobPayload`)
- `sources` — список источников в виде строк (сейчас передаётся пустой массив, будет заполняться из OpenSearch)
- Возвращает готовый текст саммари

## Провайдеры

### Первичный — Anthropic Claude

- Модель: `claude-sonnet-4-6`
- `max_tokens`: 4096
- Использует **streaming** через `.stream().finalMessage()` — предотвращает таймауты на длинных ответах
- Системный промпт помечен `cache_control: { type: "ephemeral" }` — Anthropic кешируют его на стороне сервера (~5 мин TTL), что снижает стоимость и задержку при повторных вызовах с тем же промптом

### Fallback — OpenAI

- Активируется автоматически при любой ошибке Anthropic (сетевой, API-ошибке, таймауте)
- Модель: `gpt-4o-mini`
- `max_tokens`: 4096
- Факт переключения логируется как `WARN`

### Формирование сообщений

```
SYSTEM (кешируется):
  "You are an expert research assistant. Given a topic and a list
   of sources, write a clear, well-structured summary (3–5 paragraphs).
   Cite sources inline where relevant. Be objective and factual."

USER (не кешируется, меняется каждый запрос):
  Topic: <topic>

  Sources:
  [1] <source 1>
  [2] <source 2>
  ...
```

Разделение стабильного (system) и переменного (user) контента — обязательное условие для работы prompt caching: изменение user-части не инвалидирует кеш системного промпта.

## Конфигурация

| Переменная          | Обязательна | Описание                   |
|---------------------|-------------|----------------------------|
| `ANTHROPIC_API_KEY` | Нет*        | Ключ Anthropic API         |
| `OPENAI_API_KEY`    | Нет*        | Ключ OpenAI API            |

*При отсутствии ключей приложение стартует, но задачи будут падать с ошибкой на этапе обработки.

---

## Rate Limiting (Throttler)

Ограничение запросов реализовано через `@nestjs/throttler`.

### Конфигурация (`AppModule`)

```typescript
ThrottlerModule.forRoot([
  { name: 'default', ttl: 60_000, limit: 60 },  // остальные эндпоинты
  { name: 'ai',      ttl: 60_000, limit: 1  },  // AI-запросы
])
```

`ThrottlerGuard` зарегистрирован глобально через `APP_GUARD` — защищает все маршруты по правилу `default`.

### Применение на эндпоинте

`POST /api/v1/reports` переопределяет лимит через декоратор:

```typescript
@Post()
@Throttle({ ai: { ttl: 60_000, limit: 1 } })
create(@CurrentUser() user: User, @Body() dto: CreateReportDto) { ... }
```

Декоратор `@Throttle` полностью заменяет правило для этого хендлера — применяется только `ai`-лимит, `default` игнорируется.

При превышении лимита возвращается `429 Too Many Requests`.

### Хранение счётчиков

По умолчанию `@nestjs/throttler` хранит счётчики **в памяти процесса**.
Это означает, что при перезапуске приложения счётчики сбрасываются и лимиты не работают в multi-instance окружении.

---

## Что нужно сделать перед продакшеном

### 1. Перенести throttle-счётчики в Redis

Установить `@nestjs/throttler-storage-redis` и подключить к существующему Redis-подключению:

```bash
npm install @nestjs/throttler-storage-redis
```

```typescript
// app.module.ts
import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';

ThrottlerModule.forRoot({
  throttlers: [
    { name: 'default', ttl: 60_000, limit: 60 },
    { name: 'ai',      ttl: 60_000, limit: 1  },
  ],
  storage: new ThrottlerStorageRedisService(process.env.REDIS_URL),
})
```

Без этого горизонтальное масштабирование (несколько инстансов) даёт каждому свой счётчик — пользователь сможет делать `N × limit` запросов.

### 2. Throttle по user ID, а не по IP

По умолчанию `ThrottlerGuard` идентифицирует клиента по IP-адресу. За балансировщиком или прокси все запросы будут выглядеть как один IP.

Создать кастомный guard с трекингом по `user.id`:

```typescript
// src/common/guards/user-throttler.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { id?: string } | undefined;
    return user?.id ?? (req['ip'] as string);
  }
}
```

Заменить `ThrottlerGuard` на `UserThrottlerGuard` в `APP_GUARD`.

### 3. Установить реальный лимит для продакшена

Текущий лимит (1 req/min) установлен для тестирования. Подобрать значение исходя из:
- Стоимости одного вызова AI (модель, длина ответа)
- Ожидаемого числа активных пользователей
- Тарифных планов (для платных пользователей можно выдавать отдельный throttle-профиль через `SubscriptionGuard`)

Рекомендуемая отправная точка: **10 req/min** для бесплатного плана, **60 req/min** для платного.

### 4. Добавить заголовки `Retry-After` и `X-RateLimit-*`

`@nestjs/throttler` добавляет заголовки автоматически при стандартной конфигурации, но убедиться, что они не срезаются nginx/балансировщиком. Клиент должен видеть `Retry-After` в ответе на `429`.

### 5. Алерты на fallback-переключения

Сейчас переключение Anthropic → OpenAI логируется как `WARN`. В продакшене настроить алерт (Sentry, Datadog, Grafana) на этот лог — массовые fallback-переключения сигнализируют об инциденте на стороне Anthropic или о превышении rate limit самого API.

### 6. Обеспечить уникальность API-ключей по окружениям

Не использовать один и тот же `ANTHROPIC_API_KEY` в dev и prod — квоты могут быть разными, а лог-трейсы в Anthropic Console перемешаются.
