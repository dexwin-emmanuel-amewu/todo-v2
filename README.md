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

`GET /todos` returns a page of todos, oldest first (`created_at` ascending, `id` ascending as a tie-breaker). Filter with `?status=all|active|completed` (`all` is also the default when omitted). Any other value, or the param repeated more than once, returns 400.

Search titles with `?search=<term>`. The match is a case-insensitive substring, not a prefix. The term is trimmed; a blank or whitespace-only value behaves the same as omitting the param. Terms over 100 characters, or the param repeated more than once, return 400. `search` combines with `status` using AND.

Paginate with `?page=<n>&pageSize=<n>`. `page` defaults to 1, `pageSize` defaults to 20 with a maximum of 100. Both must be positive integers; anything else, an out-of-range value, or a repeated param, returns 400. A page beyond the last one returns 200 with an empty `items` array rather than an error. The response body is `{ "items": Todo[], "page": number, "pageSize": number, "totalItems": number, "totalPages": number }`, where `totalItems`/`totalPages` reflect the current `status`/`search` filters. An empty database returns `{ "items": [], "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 }`.

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

GET /todos/:todoId returns a single todo. `todoId` must be a well-formed UUID.

```
curl http://localhost:3000/todos/5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a
```

Success: 200 with the todo object on its own, not wrapped in an envelope. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` when the id is not a well-formed UUID, 404 with `{ "error": { "type": "not_found" } }` when the id is well-formed but matches no todo, 500 with `{ "error": { "type": "internal" } }` for a server-side failure. A malformed id is always a 400 and never a 404, and the 404 body does not echo the requested id back.

## Tests

apps/api's tests need Postgres running (pnpm docker:up). They create their own disposable database per run and drop it when done, so they won't touch your local data.
pnpm --filter api test
pnpm --filter web test
