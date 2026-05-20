# Entities

Все сущности расположены в `src/modules/<module>/` (и `src/common/entities/`).
Каждая таблица создаётся и изменяется **только через TypeORM-миграции** (`src/database/migrations/`).

---

## BaseEntity

**Файл:** `src/common/entities/base.entity.ts`
**Тип:** абстрактный класс, не имеет собственной таблицы

Базовый класс, от которого наследуются все сущности.

| Колонка      | Тип               | Описание                          |
|--------------|-------------------|-----------------------------------|
| `id`         | `uuid` (PK)       | Генерируется автоматически (uuid4)|
| `created_at` | `timestamptz`     | Устанавливается при создании      |
| `updated_at` | `timestamptz`     | Обновляется при каждом изменении  |

---

## User

**Файл:** `src/modules/users/user.entity.ts`
**Таблица:** `users`

Учётная запись пользователя.

| Колонка               | Тип                                   | Описание                                        |
|-----------------------|---------------------------------------|-------------------------------------------------|
| `id`                  | `uuid` (PK)                           | Наследуется от BaseEntity                       |
| `email`               | `varchar` UNIQUE NOT NULL             | Email пользователя, используется для входа      |
| `password_hash`       | `varchar` NOT NULL                    | Bcrypt-хеш пароля (10 rounds). Исключается из ответов через `@Exclude()` |
| `subscription_status` | `enum` NOT NULL, default `free`       | Статус подписки: `free`, `active`, `cancelled`  |
| `created_at`          | `timestamptz`                         | Наследуется от BaseEntity                       |
| `updated_at`          | `timestamptz`                         | Наследуется от BaseEntity                       |

**Enum `SubscriptionStatus`:**

| Значение    | Описание                          |
|-------------|-----------------------------------|
| `free`      | Бесплатный план (по умолчанию)    |
| `active`    | Активная платная подписка         |
| `cancelled` | Подписка отменена                 |

---

## RefreshToken

**Файл:** `src/modules/auth/entities/refresh-token.entity.ts`
**Таблица:** `refresh_tokens`

Хранит действующие refresh-токены. Используется при ротации: при обновлении старый токен удаляется и выпускается новая пара.

| Колонка      | Тип           | Описание                                                     |
|--------------|---------------|--------------------------------------------------------------|
| `id`         | `uuid` (PK)   | Наследуется от BaseEntity                                    |
| `token`      | `varchar`     | JWT refresh-токен в виде строки                              |
| `expires_at` | `timestamptz` | Дата истечения (через 7 дней от выпуска)                     |
| `user_id`    | `uuid` (FK)   | Ссылка на `users.id`, при удалении пользователя каскадно удаляется |
| `created_at` | `timestamptz` | Наследуется от BaseEntity                                    |
| `updated_at` | `timestamptz` | Наследуется от BaseEntity                                    |

**Связи:** `ManyToOne → User` (с `onDelete: CASCADE`)

---

## ResearchReport

**Файл:** `src/modules/research/research-report.entity.ts`
**Таблица:** `research_reports`

Отчёт по исследованию. Создаётся синхронно при POST-запросе в статусе `pending`, затем обновляется BullMQ-процессором по мере выполнения задачи.

| Колонка         | Тип              | Описание                                                       |
|-----------------|------------------|----------------------------------------------------------------|
| `id`            | `uuid` (PK)      | Наследуется от BaseEntity                                      |
| `user_id`       | `uuid` (FK)      | Ссылка на `users.id`, при удалении пользователя каскадно удаляется |
| `topic`         | `varchar`        | Тема исследования, введённая пользователем                     |
| `status`        | `enum` NOT NULL, default `pending` | Текущий статус обработки               |
| `summary`       | `text` NULLABLE  | Готовый текст саммари, заполняется после успешной обработки    |
| `sources`       | `jsonb` NULLABLE | Массив источников, использованных при генерации                |
| `error_message` | `text` NULLABLE  | Текст ошибки, заполняется при статусе `failed`                 |
| `created_at`    | `timestamptz`    | Наследуется от BaseEntity                                      |
| `updated_at`    | `timestamptz`    | Наследуется от BaseEntity                                      |

**Связи:** `ManyToOne → User` (с `onDelete: CASCADE`)

**Enum `ReportStatus`:**

| Значение     | Описание                                               |
|--------------|--------------------------------------------------------|
| `pending`    | Задача создана, ждёт в очереди BullMQ                  |
| `processing` | Процессор начал выполнение                             |
| `done`       | Саммари сгенерировано, поле `summary` заполнено        |
| `failed`     | Ошибка при обработке, поле `error_message` заполнено   |

**Жизненный цикл записи:**

```
POST /reports
  → создаётся запись (status: pending)
  → задача добавляется в BullMQ
    → processor: status: processing
      → AiService.summarize()
        → success: status: done, summary заполнен
        → error:   status: failed, error_message заполнен
```

---

## Планируемые сущности

| Сущность       | Таблица         | Описание                                                  |
|----------------|-----------------|-----------------------------------------------------------|
| `Subscription` | `subscriptions` | Stripe-подписка: stripeCustomerId, stripeSubscriptionId, plan, status |

Добавляются по мере реализации соответствующих модулей через миграции.
