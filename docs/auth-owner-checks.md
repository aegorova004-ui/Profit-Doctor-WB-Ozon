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

`src/server/auth-session.ts` содержит:

- `resolveCurrentUserFromSessionToken`;
- lookup сессии только по hash токена;
- отказ для отсутствующей, истёкшей или отозванной сессии;
- обновление `lastUsedAt` через repository boundary.

`src/server/auth-cookie.ts` содержит:

- имя session cookie `profit_doctor_session`;
- `httpOnly`, `sameSite=lax`, `path=/`;
- `secure=true` для production;
- max age 30 дней и helper для очистки cookie.

`src/server/auth-login-code.ts` содержит:

- выпуск одноразового login code с нормализацией email;
- хранение только `codeHash`, без plaintext-кода;
- срок действия 10 минут;
- проверку последнего кода по email;
- timing-safe проверку кода через `verifySecret`;
- отказ для пустого, неверного, истёкшего или уже использованного кода;
- погашение кода до выдачи пользователя через repository boundary.

`src/server/auth-prisma-repository.ts` содержит Prisma adapter для auth foundation:

- создание `LoginCode` без plaintext-кода;
- загрузку последнего login code по email;
- atomic-погашение непогашенного кода через `updateMany`;
- upsert пользователя по нормализованному email;
- загрузку session по `tokenHash` с минимальными полями пользователя;
- обновление `lastUsedAt` без изменения revoked-сессий;
- создание `AuthSession` по `userId`, `tokenHash` и `expiresAt`.

`src/server/prisma.ts` содержит singleton Prisma client для server-side кода:

- переиспользует client в development/HMR;
- не сохраняет singleton в production.

`src/server/auth-flow.ts` содержит прикладной auth-flow без привязки к конкретному email provider:

- request login code: создаёт hash-код и отдаёт plaintext только delivery-callback;
- verify login code: гасит валидный код, создаёт session token и сохраняет только `tokenHash`;
- возвращает `invalid_code` без создания сессии, если код неверный, истёкший или уже использован.

`src/server/auth-current-user.ts` содержит cookie-boundary helper:

- читает только cookie `profit_doctor_session`;
- передаёт token в `resolveCurrentUserFromSessionToken`;
- возвращает текущего пользователя и единую cookie policy;
- не обращается к repository, если session cookie отсутствует.

`src/server/auth-validation.ts` содержит validation слой для будущих auth route handlers:

- нормализацию и проверку email;
- проверку шестизначного login code;
- проверку request payload для выпуска кода;
- проверку verify payload для погашения кода.

`src/server/auth-http.ts` содержит public HTTP response mapping для будущих auth route handlers:

- `400` для некорректного email или формата кода;
- `401` для невалидного login code без раскрытия причины;
- `429 rate_limited` для превышения лимита с публичным `retryAfterSeconds`;
- `503 delivery_unavailable`, если отправка кода ещё не настроена;
- стабильные пользовательские сообщения для UI.

`src/server/auth-api.ts` содержит framework-agnostic API-контракт для auth endpoints:

- request-code валидирует payload, проверяет доступность delivery provider и rate-limit, затем выпускает код;
- verify-code валидирует payload, проверяет rate-limit, создаёт session token и возвращает только cookie metadata;
- session token не попадает в JSON-ответ.

`src/app/api/auth/request-code/route.ts` и `src/app/api/auth/verify-code/route.ts` подключают контракт к Next route handlers. Отправка кода сейчас намеренно выключена через `createUnavailableLoginCodeDelivery`: endpoint возвращает `503 delivery_unavailable` и не создаёт login code, пока не выбран реальный email/OTP provider.

`src/server/auth-current-user-api.ts` и `src/app/api/auth/me/route.ts` подключают чтение текущего пользователя по session cookie:

- сервер читает только `profit_doctor_session`;
- lookup идёт через hash session token;
- без cookie возвращается `401 unauthenticated` без repository-запроса.

`src/server/auth-logout.ts` и `src/app/api/auth/logout/route.ts` подключают выход:

- session token читается только из cookie;
- в БД пишется `revokedAt` по hash token;
- cookie очищается даже тогда, когда session cookie уже отсутствует.

`src/server/auth-rate-limit.ts` содержит rate-limit policy для будущих auth route handlers:

- не более 3 запросов login code за 15 минут;
- не более 5 попыток проверки login code за 15 минут;
- rolling-window расчёт `retryAfterSeconds`;
- отказ от невалидной policy на уровне helper.

`src/server/auth-memory-rate-limit.ts` содержит временный in-memory store событий rate-limit для preview/dev route handlers. Это не production-замена Redis/PostgreSQL rate-limit, потому что память не общая между инстансами.

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

`src/server/auth-session.test.ts` покрывает:

- отсутствие cookie/session token;
- lookup по hash вместо plaintext;
- неизвестную, истёкшую и отозванную сессию;
- обновление `lastUsedAt` только для валидной сессии.

`src/server/auth-cookie.test.ts` покрывает:

- имя cookie;
- local/production cookie policy;
- очистку session cookie без ослабления настроек.

`src/server/auth-login-code.test.ts` покрывает:

- выпуск кода без хранения plaintext;
- нормализацию email;
- успешное погашение валидного кода;
- отказ для пустого, неизвестного, неверного, истёкшего и уже использованного кода.

`src/server/auth-prisma-repository.test.ts` покрывает:

- Prisma-запросы для login codes, users и auth sessions;
- отсутствие plaintext-кода в create-запросе;
- выбор минимального набора auth-полей;
- защиту от обновления revoked-сессий при `markUsed`.
- revocation auth-сессий без изменения уже revoked-сессий.

`src/server/auth-flow.test.ts` покрывает:

- отправку plaintext login code только через delivery-callback;
- создание session token с сохранением только hash;
- отказ без создания сессии при невалидном коде.

`src/server/auth-current-user.test.ts` покрывает:

- чтение правильной session cookie;
- отсутствие запроса к repository без cookie;
- резолв текущего пользователя через hash lookup;
- возврат единой cookie policy.

`src/server/auth-current-user-api.test.ts` покрывает:

- `200` с текущим пользователем по session cookie;
- `401 unauthenticated` без repository-запроса.

`src/server/auth-logout.test.ts` покрывает:

- revocation текущей session через hash token;
- очистку session cookie;
- отсутствие repository-запроса без cookie.

`src/server/auth-validation.test.ts` покрывает:

- нормализацию валидного email;
- отказ для пустого, нестрокового, слишком длинного и некорректного email;
- отказ для пустого и некорректного login code;
- нормализацию request/verify payload.

`src/server/auth-http.test.ts` покрывает:

- успешный auth-ответ;
- mapping validation errors в `400`;
- единый `401 invalid_code` для неверного, истёкшего или уже использованного кода;
- `429 rate_limited` и задержку повтора без раскрытия внутренних деталей лимита;
- `503 delivery_unavailable` для не подключённой отправки кода.

`src/server/auth-api.test.ts` покрывает:

- отказ по невалидному payload до repository-запросов;
- отказ `503 delivery_unavailable` без создания login code;
- `429 rate_limited` для request-code;
- успешную отправку кода только через delivery provider;
- `401 invalid_code` без раскрытия причины;
- успешную verify-code с session cookie metadata без токена в JSON.

`src/server/auth-memory-rate-limit.test.ts` покрывает:

- раздельные события request-code и verify-code;
- очистку устаревших событий вне окна хранения.

`src/server/auth-rate-limit.test.ts` покрывает:

- разрешение действия при свободных попытках;
- блокировку при исчерпанном лимите;
- игнорирование событий вне rolling window;
- отдельную policy для проверки кода;
- отказ для невалидной policy.

## Что ещё нужно перед серверной историей

- Выбрать конкретного провайдера email magic link/OTP.
- Заменить `createUnavailableLoginCodeDelivery` на реальный email/OTP delivery provider.
- Подключить `resolveCurrentUserFromCookies` к Next route handlers.
- Заменить временный in-memory rate-limit store на durable Redis/PostgreSQL policy перед production.
- Подключить guards к будущим data access functions.
- Добавить integration-тесты на реальные Prisma-запросы, когда появятся server routes для истории.
- Описать срок хранения исходных файлов и механизм удаления, если продукт решит сохранять файлы.
