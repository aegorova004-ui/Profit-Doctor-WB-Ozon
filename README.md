# Profit Doctor WB/Ozon

Web-SaaS для продавцов Wildberries и Ozon: пользователь загружает отчёт маркетплейса и получает расчёт прибыльности по SKU, список убыточных позиций и понятные рекомендации.

Проект находится на этапе `Sprint 0: Foundation`. Текущий статус и ближайшие задачи описаны в [`PROJECT_STATE.md`](PROJECT_STATE.md), план этапов — в [`ROADMAP.md`](ROADMAP.md).

## Стек

- Next.js 16, React 19 и TypeScript;
- Tailwind CSS;
- PostgreSQL и Prisma;
- unit-, integration- и e2e-тесты для критичных сценариев по мере развития MVP.

## Локальный запуск

Требуются Node.js 20.9.0 или новее, npm и доступная PostgreSQL.

```bash
npm ci
```

Создайте локальный `.env` по образцу `.env.example`, затем подготовьте Prisma Client:

```bash
npm run db:migrate
npm run db:generate
npm run db:validate
npm run dev
```

Если PostgreSQL пока недоступна, `db:generate`, `db:validate`, тесты и сборка работают с корректной тестовой `DATABASE_URL`, но миграция не применяется до подключения сервера.

Приложение откроется по адресу [http://localhost:3000](http://localhost:3000).

## Проверки

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

CI запускает эти проверки, а также валидацию Prisma, для каждого pull request и push в `main`.

Для автоматических Issues включите GitHub Issues. Сами workflow запрашивают только явные минимальные разрешения `contents: read` и `issues: write`; менять глобальные `Workflow permissions` на `Read and write` не требуется. Расписания выполняются только для версии workflow из default branch; оба напоминания также можно запустить вручную через `workflow_dispatch`.

## Рабочий процесс

1. Прочитайте [`AGENTS.md`](AGENTS.md) и [`PROJECT_STATE.md`](PROJECT_STATE.md).
2. Возьмите задачу из текущего спринта или GitHub Issue.
3. Создайте ветку `codex/<краткое-имя>` и отдельный PR.
4. Запустите релевантные проверки и обновите документацию.

Финансовые правила описаны в [`docs/finance-formulas.md`](docs/finance-formulas.md), контракт импорта — в [`docs/report-formats.md`](docs/report-formats.md), подготовка релиза — в [`docs/release-checklist.md`](docs/release-checklist.md).

## Важные ограничения

- Не коммитьте `.env`, отчёты продавцов, ключи и персональные данные.
- Не используйте реальные отчёты в fixtures без полной анонимизации.
- Не заявляйте точный результат, если в отчёте нет необходимых полей: такой расчёт должен быть помечен как оценка.
- Оплата и публикация должны быть доступны пользователям из России; зарубежные магазины приложений не должны быть основой продукта.
