# Auth и owner checks

Обновлено: 21 июля 2026 года.

Этот документ фиксирует минимальную политику доступа до появления серверной истории отчётов. Пока Sprint 1 считает отчёты локально в браузере, исходные XLSX/CSV не отправляются на сервер и не сохраняются.

## Решение для MVP

- Базовая стратегия входа — email magic link или одноразовый код по email.
- Перед записью email обрезается и приводится к нижнему регистру; PostgreSQL `citext` остаётся дополнительной защитой от дублей.
- Любой серверный сценарий с отчётами работает только с `AuthenticatedUser`.
- Серверная история отчётов не добавляется, пока нет тестов на запрет доступа к чужим данным.

## Owner model

Единственный владелец отчёта — `UploadedReport.userId`.

Связанные строки и снимки прибыли наследуют владельца через `reportId`:

- `ReportRow.reportId → UploadedReport.id → UploadedReport.userId`;
- `ProductProfitSnapshot.reportId → UploadedReport.id → UploadedReport.userId`.

Нельзя доверять `userId`, пришедшему от клиента. Сервер берёт пользователя из auth-сессии и добавляет `userId` в запрос сам.

## Правила доступа

1. Неавторизованный пользователь получает `AuthRequiredError`.
2. Авторизованный пользователь без владения ресурсом получает `AccessDeniedError`.
3. Для отсутствующего или чужого отчёта ответ одинаковый: не раскрывать, существует ли чужой идентификатор.
4. Любой read/update/delete для `UploadedReport` фильтруется по `id + userId`.
5. Любой read/update/delete для `ReportRow` и `ProductProfitSnapshot` проверяет владельца через родительский `UploadedReport`.
6. Сырые строки отчёта, имена кабинетов, контакты и другие чувствительные поля не логируются.

## Реализованный фундамент

Prisma schema содержит:

- `LoginCode` — одноразовый код входа по email; хранит `email`, `codeHash`, `expiresAt`, `consumedAt`, но не хранит код в открытом виде;
- `AuthSession` — серверная сессия пользователя; хранит `tokenHash`, `expiresAt`, `revokedAt`, `lastUsedAt`, но не хранит cookie-token в открытом виде.

`src/server/access-control.ts` содержит:

- `normalizeEmail`;
- `requireAuthenticatedUser`;
- `assertOwnsResource` и `assertOwnsReport`;
- `scopedByCurrentUser`;
- `requireOwnedResource`.

`src/server/auth-tokens.ts` содержит:

- генерацию login code;
- генерацию session token;
- SHA-256 hash секрета;
- constant-time проверку секрета;
- helpers для срока действия.

`src/server/access-control.test.ts` покрывает:

- нормализацию email;
- отказ без auth;
- доступ к своему отчёту;
- отказ к чужому или отсутствующему отчёту;
- защиту от caller-provided `userId`;
- загрузку ресурса только через scope текущего пользователя.

`src/server/auth-tokens.test.ts` покрывает:

- hash/verify без хранения plaintext;
- отказ на malformed hash;
- длину и формат session token;
- длину login code;
- расчёт expiry.

## Что ещё нужно перед серверной историей

- Выбрать конкретного провайдера email magic link/OTP.
- Добавить session storage и server-side получение текущего пользователя.
- Подключить guards к будущим data access functions.
- Добавить integration-тесты на реальные Prisma-запросы, когда появятся server routes для истории.
- Описать срок хранения исходных файлов и механизм удаления, если продукт решит сохранять файлы.
