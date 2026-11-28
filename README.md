## Run the full app with Docker

One command builds and starts PostgreSQL, the migration, the API, and the web app:

```
docker compose up --build -d --wait
```

Open `http://localhost:8080`. The web server proxies `/todos` and `/health` to the API, so `curl http://localhost:8080/health` returns `{ "status": "ok" }`.

The services start in order. `postgres` must be healthy, then `migrate` applies `apps/api/drizzle` and exits, then `api` starts and must pass `/health`, then `web` starts. If the migration fails, the API never starts and the command fails.

The host ports are 5432 for Postgres and 8080 for the web app. Set `POSTGRES_PORT` or `WEB_PORT` to use others. The API is not published to the host.

Stop it with `docker compose down`. Your data is kept in the `postgres-data` volume. To start from a clean database, run `docker compose down -v` first. This deletes all local todos, including the ones you use with `pnpm dev`.

The same command is `pnpm docker:app`.

## Setup

pnpm install
cp .env.example .env

## Starting the app

Start Postgres first:
pnpm docker:up

Apply the migrations:
pnpm --filter api db:migrate

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

The home page lists todos from `GET /todos`, oldest first. You can add, edit, toggle, and delete a todo. You can filter by All, Active, or Completed, search titles, and change the page and page size. The toggle-all control marks every todo completed or active, and "Clear completed" deletes the completed todos. Selection mode selects up to 100 todos across pages to mark them completed, mark them active, or delete them.

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

PUT /todos/:todoId replaces a todo's `title` and `completed`. Body: `{ "title": string, "completed": boolean }` (title 6-100 chars after trimming). Both fields are required — this is a full replacement, not a partial update. `id` and `createdAt` never change; extra body fields are ignored.

```
curl -X PUT http://localhost:3000/todos/5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy oat milk", "completed": true}'
```

Success: 200 with the updated todo. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a malformed id or an invalid body (the id check runs first, so a bad id and a bad body together return only the id's 400), 404 with `{ "error": { "type": "not_found" } }` when the id is well-formed but matches no todo (no row is created), 500 with `{ "error": { "type": "internal" } }` for a server-side failure.

PATCH /todos/:todoId partially updates a todo. Body: any non-empty subset of `{ "title": string, "completed": boolean }` — send just `title`, just `completed`, or both. A field you omit keeps its current value; a field you include is validated the same way PUT validates it (title 6-100 chars after trimming). An empty body `{}`, or a body with no recognized fields, is rejected. `id` and `createdAt` never change.

```
curl -X PATCH http://localhost:3000/todos/5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

Success: 200 with the updated todo. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a malformed id, an empty/unrecognized body, or an invalid field value (the id check runs first, so a bad id wins over any body problem), 404 with `{ "error": { "type": "not_found" } }` when the id is well-formed but matches no todo (no row is created), 500 with `{ "error": { "type": "internal" } }` for a server-side failure. Unlike PUT, PATCH never requires both fields, so a body PUT would reject for missing `completed` is valid for PATCH.

PATCH /todos marks the whole collection active or complete. Body: `{ "completed": boolean }`, required. Every todo whose `completed` value differs from the request is updated in one statement; todos already matching are left untouched, including their `updated_at`. There is no `status`/`search` scoping, this always applies to the entire collection.

```
curl -X PATCH http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

Success: 200 with `{ "updatedCount": number }`, the count of todos actually changed, not the todos themselves. An empty collection, or one already matching the requested value, returns 200 with `{ "updatedCount": 0 }`. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a missing or non-boolean `completed`, 500 with `{ "error": { "type": "internal" } }` for a server-side failure.

PATCH /todos/batch marks the listed todos active or complete. Body: `{ "ids": string[], "completed": boolean }`, both required. `ids` holds 1 to 100 well-formed UUIDs with no duplicates. Every listed todo is updated in one transaction, including todos that already match. Either every listed todo changes or none do.

```
curl -X PATCH http://localhost:3000/todos/batch \
  -H "Content-Type: application/json" \
  -d '{"ids": ["5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a"], "completed": true}'
```

Success: 200 with `{ "updatedCount": number }`, always equal to the number of ids. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for an empty, oversized, duplicate, or malformed `ids`, or a missing or non-boolean `completed`, 409 with `{ "error": { "type": "batch_conflict", "missingIds": string[] } }` when any id matches no todo (nothing is changed), 500 with `{ "error": { "type": "internal" } }` for a server-side failure (nothing is changed).

POST /todos/batch-delete deletes the listed todos. Body: `{ "ids": string[] }`, required. `ids` holds 1 to 100 well-formed UUIDs with no duplicates. Every listed todo is deleted in one transaction. Either every listed todo is deleted or none are. This is a hard delete, so a repeated request returns 409.

```
curl -X POST http://localhost:3000/todos/batch-delete \
  -H "Content-Type: application/json" \
  -d '{"ids": ["5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a"]}'
```

Success: 200 with `{ "deletedCount": number }`, always equal to the number of ids. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a missing, empty, oversized, duplicate, or malformed `ids`, 409 with `{ "error": { "type": "batch_conflict", "missingIds": string[] } }` when any id matches no todo (nothing is deleted), 500 with `{ "error": { "type": "internal" } }` for a server-side failure (nothing is deleted).

DELETE /todos/:todoId deletes a todo. No request body is read. This is a hard delete: the row is removed permanently, and a repeated delete of the same id is a 404, not a second 204.

```
curl -X DELETE http://localhost:3000/todos/5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a
```

Success: 204 with no body. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a malformed id, 404 with `{ "error": { "type": "not_found" } }` when the id is well-formed but matches no todo, 500 with `{ "error": { "type": "internal" } }` for a server-side failure.

DELETE /todos?status=completed removes every completed todo in one statement. The `status=completed` selector is required: a bare `DELETE /todos` is rejected, and so are `status=all`, `status=active`, any other value, a repeated `status`, and the `search`/`page`/`pageSize` params. When the selector is accepted the whole collection is cleared, whatever page or search the caller was looking at. Active todos are left alone. This is a hard delete, same as `DELETE /todos/:todoId`.

```
curl -X DELETE "http://localhost:3000/todos?status=completed"
```

Success: 200 with `{ "deletedCount": number }`, the count of todos actually removed. Nothing completed, or an empty collection, returns 200 with `{ "deletedCount": 0 }`, so a repeat call is a no-op. Failure: 400 with `{ "error": { "type": "validation", "issues": string[] } }` for a missing, wrong, duplicate, or unsupported query param, with nothing deleted, 500 with `{ "error": { "type": "internal" } }` for a server-side failure.

## Tests

apps/api's tests need Postgres running (pnpm docker:up). They create their own disposable database per run and drop it when done, so they won't touch your local data.
pnpm --filter api test
pnpm --filter web test

`pnpm test:e2e` runs the Playwright specs in `e2e/tests`. They start the web dev server and mock the API, so they cover error and pending states a real server cannot produce on demand.

`pnpm test:stack` runs `e2e/stack` against the real Docker app on `http://localhost:8080` with no mocks. It deletes every todo in that app before each test, so never point it at data you want to keep. Set `STACK_URL` to point it elsewhere.

```
docker compose down -v
docker compose up --build -d --wait
pnpm test:stack
```
