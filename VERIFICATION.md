# Final Verification — M54

Branch: `test/m54-final-verification`. Base: `main` at `4b753be`.

## Environment

| **Item**       | **Value**        |
| -------------- | ---------------- |
| Date           | 2026-11-27       |
| OS             | macOS 27.2.1     |
| Node on host   | 20.19.5          |
| Node in images | 22 (alpine)      |
| pnpm           | 10.34.5          |
| Docker Engine  | 29.4.1           |
| Docker Compose | 5.1.3            |
| Playwright     | 1.62.1, Chromium |

## The one command

```bash
docker compose up --build -d --wait
```

It builds the `api` and `web` images, starts `postgres`, waits for it to be healthy, runs `migrate`, starts `api` once the migration exits `0`, waits for `/health`, then starts `web` on port 8080. `--wait` returns only when every service is healthy. The command is documented at the top of `README.md`. `pnpm docker:app` runs the same command.

## Clean start

Each run used `docker compose down -v` first. Runs used their own compose project and ports so the local dev database was never touched.

| **Check**                                                             | **Result**                                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh clone of the branch, `pnpm install --frozen-lockfile`           | Pass. No lockfile change.                                                                                                                              |
| `docker compose up --build -d --wait` from an empty volume            | Pass. Exit `0`. All four services as expected.                                                                                                         |
| `docker compose build --no-cache` then `up --wait` in the fresh clone | Pass. Build exit `0`, up exit `0`, `pnpm test:stack` 7 passed.                                                                                         |
| `migrate` service                                                     | Exited `0`. `todos` has `created_at` and `updated_at`.                                                                                                 |
| `migrate` run a second time                                           | Exit `0`. Nothing new applied.                                                                                                                         |
| `GET /health` through port 8080                                       | `{"status":"ok"}`                                                                                                                                      |
| `GET /todos` through port 8080 on a clean database                    | `{"items":[],"page":1,"pageSize":20,"totalItems":0,"totalPages":0}`                                                                                    |
| `GET /` through port 8080                                             | `200 text/html`                                                                                                                                        |
| Data after `docker compose down` and `up`                             | Kept.                                                                                                                                                  |
| Data after `docker compose down -v` and `up`                          | Gone.                                                                                                                                                  |
| Migration made to fail with a bad password                            | `migrate` exited `1`. `api` and `web` stayed in `created` and never started. Compose printed `service "migrate" didn't complete successfully: exit 1`. |
| API stopped while the page loads                                      | `/todos` returned `502`. The page showed "Could not load your todos." with Retry.                                                                      |
| API started again, Retry pressed                                      | The list loaded with the todo created before the outage.                                                                                               |

## Checks

| **Command**         | **Result**                                                           |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm format:check` | Pass                                                                 |
| `pnpm lint`         | Pass                                                                 |
| `pnpm typecheck`    | Pass, including `e2e`                                                |
| `pnpm test`         | contracts 68 passed. api 287 passed. web 487 passed. See finding F5. |
| `pnpm test:e2e`     | 30 passed                                                            |
| `pnpm test:stack`   | 7 passed. Run twice on the working tree and once in the fresh clone. |
| CI `check` job      | Pending. Link the run here.                                          |
| CI `stack` job      | Pending. Link the run here.                                          |

## Journey matrix

`stack` is `e2e/stack/journey.spec.ts` on the real Docker app. `mock` is `e2e/tests` with a mocked API.

| **Journey**                                                     | **Proved by**                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Start empty                                                     | stack: starts empty, adds, edits, toggles, and deletes todos                                              |
| Add todos in order with the count                               | stack: starts empty, adds, edits, toggles, and deletes todos                                              |
| Edit with the Edit button and with double click, Escape cancels | stack: starts empty, adds, edits, toggles, and deletes todos                                              |
| Toggle one todo and back, survives reload                       | stack: starts empty, adds, edits, toggles, and deletes todos                                              |
| Delete one todo                                                 | stack: same test. mock: deleting a todo sends DELETE, removes the row, and moves focus to the next Delete |
| Filter All, Active, Completed                                   | stack: filters and searches against the real server. mock: each filter requests its server filter         |
| Search                                                          | stack: filters and searches against the real server. mock: search-todos.spec.ts                           |
| Paginate and change page size                                   | stack: paginates and resets to page 1 on a search. mock: paginate-todos.spec.ts                           |
| Search resets to page 1                                         | stack: paginates and resets to page 1 on a search. mock: a search change resets to page 1                 |
| Toggle all                                                      | stack: toggles every todo and clears completed todos. mock: toggle-all-todos.spec.ts                      |
| Clear completed                                                 | stack: toggles every todo and clears completed todos. mock: clear-completed-todos.spec.ts                 |
| Select across pages                                             | stack: marks and deletes selected todos across pages. mock: select-todos.spec.ts                          |
| Selection limit of 100                                          | mock: refuses a selection past 100 todos                                                                  |
| Mark selected completed and active                              | stack: marks and deletes selected todos across pages. mock: update-selected-todos.spec.ts                 |
| Delete selected                                                 | stack: marks and deletes selected todos across pages. mock: delete-selected-todos.spec.ts                 |
| Stale selection on mark, Retry                                  | stack: recovers a stale selection after a todo is deleted elsewhere                                       |
| Stale selection on delete, Retry                                | stack: recovers a stale selection after a todo is deleted elsewhere                                       |
| Health through the web origin                                   | stack: health is served through the web origin                                                            |

## State matrix

| **State** | **Proved by**                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty     | stack: starts empty. TodoList.test.tsx: shows the empty message and no list when there are no todos. search-todos.spec.ts: a search with no matches shows a message that can clear it                                                      |
| Loading   | TodoList.test.tsx: shows a polite loading status and no list while loading. index.test.tsx: shows loading, then the todos. TodoPagination.test.tsx: disables both buttons and hides the range while a page loads                           |
| Ready     | Every stack test                                                                                                                                                                                                                           |
| Error     | search-todos.spec.ts: a failed search shows the retry alert. delete-todo.spec.ts: a server failure keeps the row. toggle-all-todos.spec.ts and clear-completed-todos.spec.ts: shows a failure with retry. Manual: API stopped, alert shown |
| Pending   | delete-selected-todos and update-selected-todos specs lock the bar. TodoToggleAll.test.tsx: is locked while toggle-all is pending. index.test.tsx: blocks saving an open editor while the request is pending                               |
| Recovery  | stack: recovers a stale selection. delete-todo.spec.ts: a 404 reconciles the stale row. Mocked Retry after `500` in five specs. Manual: Retry after the API came back                                                                      |

## Keyboard smoke test

To be run by Fatimah on `http://localhost:8080` with an empty database. Use only Tab, Shift+Tab, Enter, Space, and Escape.

| **Step** | **Action**                                                                                  | **Result** |
| -------- | ------------------------------------------------------------------------------------------- | ---------- |
| 1        | Tab to the new todo field. Type three titles, each with Enter.                              |            |
| 2        | Tab to the first row toggle. Press Space. It becomes completed.                             |            |
| 3        | Tab to Edit on the second row. Press Enter. Change the title. Press Enter to save.          |            |
| 4        | Start another edit and press Escape. The title is unchanged.                                |            |
| 5        | Tab to the Active filter. Press Enter. Only active rows show.                               |            |
| 6        | Tab to the search field and type part of a title. The list narrows.                         |            |
| 7        | Clear the search. Tab to the toggle-all control. Press Space.                               |            |
| 8        | Tab to "Clear completed". Press Enter. The list is empty and focus is on the empty heading. |            |
| 9        | Add two todos. Enter selection mode with Enter. Select both rows with Space.                |            |
| 10       | Tab to "Mark selected as completed". Press Enter. The status announces the count.           |            |
| 11       | Select both again. Tab to the delete button. Press Enter. Focus moves to the empty heading. |            |
| 12       | Add a todo, enter selection mode, press Escape to leave it.                                 |            |
| 13       | At every step the focus ring is visible and no step needs the mouse.                        |            |

Browser: \_\_\_ Date: \_\_\_

## Architecture

### Packages

- `packages/contracts`: Zod schemas shared by the API and the web app. Both sides parse with the same rules.
- `apps/api`: Fastify on Node with Drizzle on PostgreSQL.
- `apps/web`: React with TanStack Router, Query, and Form. Built by Vite and served by nginx in Docker.
- `e2e`: Playwright. `tests` mock the API. `stack` runs against the real app.

### Runtime

- `postgres` holds the `todos` table in the `postgres-data` volume.
- `migrate` applies `apps/api/drizzle` with `drizzle-kit migrate` and exits.
- `api` listens on 3000 inside the network. It is not published to the host.
- `web` is nginx on 8080. It serves the built app and proxies `/todos` and `/health` to the API. The app calls its own origin, so there is no CORS.

### API layers

1. Route in `todo.routes.ts`. It reads the request and maps each `Result` to a status with an exhaustive `match`.
2. Service in `todo.service.ts`. It parses the body or query with the contract schemas.
3. Repository in `todo.repository.ts`. It runs Drizzle queries and returns `neverthrow` results. Batch writes run in one transaction.

### Web layers

1. Adapter in `todo.api.ts`. It parses the input before sending and the response after. It throws `TodoApiError`.
2. Hooks in `hooks`. They wrap TanStack Query. Writes use `retry: 0` and invalidate the list and summary keys.
3. Modules in `module`. They build labels, messages, URL search state, and the selection reducer.
4. Components in `components`. They draw and report events.
5. `HomePage` in `routes/index.tsx`. It wires hooks to components and owns focus.

The list scope lives in the URL search params through `getTodoListSearch`. The selection lives in a reducer scoped to the status and search.

### Main contracts

| **Endpoint**                     | **Body or query**                      | **Success**                                |
| -------------------------------- | -------------------------------------- | ------------------------------------------ |
| `GET /todos`                     | `status`, `search`, `page`, `pageSize` | `200` `todoListResponseSchema`             |
| `POST /todos`                    | `createTodoSchema`                     | `201` `todoSchema`                         |
| `GET /todos/:todoId`             | `todoIdParamSchema`                    | `200` `todoSchema`                         |
| `PUT /todos/:todoId`             | `replaceTodoSchema`                    | `200` `todoSchema`                         |
| `PATCH /todos/:todoId`           | `patchTodoSchema`                      | `200` `todoSchema`                         |
| `DELETE /todos/:todoId`          | `todoIdParamSchema`                    | `204`                                      |
| `PATCH /todos`                   | `setAllTodosCompletedSchema`           | `200` `setAllTodosCompletedResponseSchema` |
| `DELETE /todos?status=completed` | `status`                               | `200` `clearCompletedTodosResponseSchema`  |
| `PATCH /todos/batch`             | `updateSelectedTodosSchema`            | `200` `updateSelectedTodosResponseSchema`  |
| `POST /todos/batch-delete`       | `deleteSelectedTodosSchema`            | `200` `deleteSelectedTodosResponseSchema`  |
| `GET /health`                    | none                                   | `200` `{ status: "ok" }`                   |

### Failure paths

| **Where** | **Failure**               | **Result**                                                                             |
| --------- | ------------------------- | -------------------------------------------------------------------------------------- |
| API       | Bad body, query, or id    | `ValidationError`, `400` `validationErrorResponseSchema`                               |
| API       | Id not found              | `NotFoundError`, `404` `notFoundErrorResponseSchema`                                   |
| API       | Batch with missing ids    | Transaction rolls back. `BatchConflictError`, `409` `batchConflictErrorResponseSchema` |
| API       | Database error            | `DatabaseError`. Logged. `500` `internalErrorResponseSchema`                           |
| Web       | Bad input                 | `TodoApiError` `request_validation`. Nothing is sent.                                  |
| Web       | No connection             | `TodoApiError` `network`                                                               |
| Web       | Non-2xx status            | `TodoApiError` `http` with the status                                                  |
| Web       | `409` on a batch          | `TodoApiError` `batch_conflict` with `missingIds`                                      |
| Web       | Response fails the schema | `TodoApiError` `response_validation`                                                   |
| Web       | Anything else             | Logged with `console.error`. Shown with the generic alert.                             |
| Docker    | Migration fails           | `api` and `web` never start. `--wait` fails.                                           |
| Docker    | API unhealthy             | `web` never starts. `--wait` fails.                                                    |

## Findings

| **Id** | **Severity** | **Finding**                                                                                                                                                                         | **Status**                                                    |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| F1     | High         | No Docker setup for the API or web. Compose started only Postgres.                                                                                                                  | Fixed. `Dockerfile`, `apps/web/nginx.conf`, compose services. |
| F2     | Low          | `apps/api/drizzle/0001_glorious_silvermane.sql` was not in the journal and never ran.                                                                                               | Fixed. Removed.                                               |
| F3     | Low          | `README.md` said the home page was read-only.                                                                                                                                       | Fixed.                                                        |
| F4     | Low          | No Playwright spec covered add, edit, or single toggle, and no spec ran against the real API.                                                                                       | Fixed. `e2e/stack/journey.spec.ts`.                           |
| F5     | Low          | In one `pnpm test` run that stalled for hours, two `index.test.tsx` selection tests failed. They passed in three runs after. Likely a timing flake under load.                      | Open. Watch in CI.                                            |
| F6     | Low          | `pnpm --filter api start` fails on Node 20. `@todo/contracts` points at TypeScript source, so plain `node` cannot import it. The image runs the API with `tsx`, as `pnpm dev` does. | Open. Needs a decision. Not used by any documented flow.      |
| F7     | Low          | When a batch delete empties the list, selection mode ends and the bar unmounts, so "Deleted N todos." is never announced. Focus moves to the empty heading as planned in M51.       | Open. Needs a decision.                                       |

No critical finding is open.

## Manager-selected change

| **Item**                | **Value** |
| ----------------------- | --------- |
| Request, word for word  |           |
| Plan                    |           |
| First failing test      |           |
| Commit                  |           |
| Checks after the change |           |
