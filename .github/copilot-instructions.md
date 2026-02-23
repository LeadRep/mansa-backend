## Purpose

This file gives actionable, project-specific guidance for AI coding agents working on the `mansa-backend` repository. Focus on concrete, discoverable patterns and files the humans expect you to touch.

## Big Picture

- **Service type**: Node.js + TypeScript Express API (CommonJS output). The runtime entrypoint is `dist/app.js` after `tsc` builds the code.
- **Persistence**: PostgreSQL via Sequelize. DB models live under `src/models` and SQL migrations live under `migrations/`.
- **Routing / controllers**: HTTP route definitions live in `src/routes/*` and handler logic in `src/controllers/*`. The top-level router is `src/routes/indexRoutes.ts` mounted at `/v1`.
- **Background / scheduled jobs**: Uses `node-cron` in `src/app.ts` (daily 7AM America/New_York) and `bull` is available for job queues.
- **Realtime**: Socket.IO is initialized in `src/utils/socket` and attached to the HTTP server created in `src/app.ts`.

## How to run & developer workflows (concrete)

- **Build**: `npm run build` (runs `tsc`) — outputs JS to `dist/`.
- **Dev/Start**: `npm run start` — runs `nodemon dist/app.js` so ensure you `build` after TypeScript edits.
- **Migrations**: `npm run migrate` runs Sequelize migrations using the compiled migration config in `dist/configs/database/migration.js`. Always run `npm run build` before running migration scripts in local dev.
- **Generate migration**: `npm run migration:generate -- --name your_migration_name` (uses `npx sequelize-cli migration:generate --name`).

Example sequence (bash):

```bash
npm install
npm run build
npm run migrate
npm run start
```

## Project-specific conventions & patterns

- **Compile-then-run**: This repo expects TypeScript compiled to `dist` before running runtime scripts (migrations and app). Do not run source files directly.
- **CommonJS output**: `package.json` uses `type: "commonjs"` — prefer `import`/`export` in TS but be mindful of module runtime behavior after compilation.
- **Routes**: Add new HTTP endpoints by creating a file under `src/routes` (example: `src/routes/aiRoutes.ts`) and corresponding controller under `src/controllers/`. Register the new route in `src/routes/indexRoutes.ts` to mount under `/v1`.
- **Controllers**: Controllers export handler functions (often default or named exports). Prefer the existing style (named exports like `healthCheck`) to keep consistency.
- **Database**: Use Sequelize models in `src/models`. The app calls `database.sync({})` in `src/app.ts` but migrations exist — prefer migrations for schema changes rather than relying on sync in production.

## Integration points & external deps to be careful about

- **Environment**: `dotenv` is used; runtime config comes from `.env`. Key env vars: `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `APP_PORT`, `APP_DOMAIN`, `APP_ALT_DOMAINS`.
- **APIs & SDKs**: The project uses `googleapis`, `stripe`, and `puppeteer` — check `src/controllers/*` and `src/utils/*` before changing related code.
- **Email**: `nodemailer` is present; email configs are in `src/configs/email`.

## Files to inspect first for most changes

- `src/app.ts` — app bootstrap, cron job scheduling, socket init, CORS and middlewares.
- `src/routes/indexRoutes.ts` — central routing; shows mounted subsystems (`/ai`, `/users`, `/contacts`, `/organizations`, `/scraper`, `/admin`, `/shared`).
- `src/configs/database/database.ts` — Sequelize connection; used by models.
- `src/models/` — domain models (Leads, Users, Organizations, etc.).
- `migrations/` — migration scripts; prefer adding migrations for schema changes.

## Typical code change examples

- Add endpoint: create `src/routes/yourRoute.ts`, implement handlers in `src/controllers/yourController.ts`, then import and `indexRoutes.use('/your', yourRoute)` in `src/routes/indexRoutes.ts`.
- Schema change: create a new migration under `migrations/` and run `npm run migrate` after `npm run build`.

## Logging and observability

- Uses `pino` (`src/logger.ts`) and `pino-http` middleware (`src/middlewares/httpLoggingMiddleware.ts`). Keep structured log calls consistent with `pinoLogger.info/error` used across the codebase.

## Safety notes & constraints

- Do not remove or bypass `database.sync` or the migration scripts without checking production expectations — migrations are the canonical record.
- Cron schedule runs `newUserSequence()` daily; avoid duplicating scheduled jobs inadvertently during dev by running multiple instances.

## When you need clarification

- Ask about missing env variables (some integrations require secrets in `.env`).
- If a change affects database schema, request a new migration and mention expected downtime or backfill steps.

---

If you'd like, I can iterate this with examples from a specific controller or generate a short PR template that enforces the build->migrate->test checklist.
