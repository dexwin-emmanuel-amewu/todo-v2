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

`GET /todos` returns every todo, oldest first (`created_at` ascending, `id` ascending as a tie-breaker). An empty database returns `{ "items": [] }`.

**Frontend**

pnpm --filter web dev (Runs on `http://localhost:5173`.)

Stop Postgres when you're done:
pnpm docker:down

## Database

pnpm --filter api db:generate generate a migration from apps/api/src/db/schema.ts — never hand-edit the generated SQL
pnpm --filter api db:migrate apply migrations to the database at DATABASE_URL
pnpm --filter api db:studio browse the database

## API

POST /todos creates a todo. Body: `{ "title": string }` (6-100 chars after trimming). Only `title` is read from the body — the server always assigns the id, timestamps, and initial `completed: false`.

```
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy oat milk"}'
```

Success: 201 with the created todo. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for an invalid body, 500 with `{ "error": { "type": "internal" } }` for a server-side failure.

## Tests

apps/api's tests need Postgres running (pnpm docker:up). They create their own disposable database per run and drop it when done, so they won't touch your local data.
pnpm --filter api test
pnpm --filter web test
