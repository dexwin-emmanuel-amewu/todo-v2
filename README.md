## Setup

pnpm install
cp .env.example .env

## Starting the app

Start Postgres first:
pnpm docker:up

Both apps at once:
pnpm dev

**Backend**
pnpm --filter api dev

Runs the Fastify API on `http://localhost:3000`. Check it's up with `curl http://localhost:3000/health`. Needs Postgres running (pnpm docker:up) and DATABASE_URL set (see .env.example).

**Frontend**

pnpm --filter web dev (Runs on `http://localhost:5173`.)

Stop Postgres when you're done:
pnpm docker:down

## Database

pnpm --filter api db:generate generate a migration from apps/api/src/db/schema.ts — never hand-edit the generated SQL
pnpm --filter api db:migrate apply migrations to the database at DATABASE_URL
pnpm --filter api db:studio browse the database

## Tests

apps/api's tests need Postgres running (pnpm docker:up). They create their own disposable database per run and drop it when done, so they won't touch your local data.
pnpm --filter api test
pnpm --filter web test
