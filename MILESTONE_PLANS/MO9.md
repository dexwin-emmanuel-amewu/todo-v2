# Milestone Plan: M09
## Milestone details
| Item	| Value |
|-------|-------|
| Milestone	| M09 |
| Capability	| Filter GET /todos |
| Branch name	| feat/m10-filter-todos |
| Planned submission date	| 2026-08-26 |
| Requirements	| https://docs.google.com/document/d/1YWVyLVYAYmGd8dAM1T1oBoSHYM24Cj0oFqCnWNyhMuE/edit?tab=t.0 |

#### Objective: Add only the All, Active, and Completed list filters

## Included
- status query param on GET /todos: all, active, completed.
- Default behaviour when status is omitted.
- Rejecting unknown status values.
- Handling a duplicate status query param (e.g. ?status=active&status=completed).
- Repository query changes to filter by completed.
- Regression tests so existing unfiltered list behaviour still passes.

## Not included
- Search or free-text filtering.
- Pagination, limit, or offset.
- Filtering by any field other than completed.
- Sorting changes (existing createdAt asc, id asc order stays).
- Frontend integration or UI.

## Current repository evidence
What files, commands, or existing patterns did you inspect before making this plan?
- apps/api/src/module/todo.routes.ts: GET /todos calls listTodos(db) with no arguments and ignores request.query.
- apps/api/src/module/todo.repository.ts: listTodos(db) runs db.select().from(todos).orderBy(asc(todos.createdAt), asc(todos.id)) with no where clause.
- apps/api/src/db/schema.ts: todos.completed is a non-null boolean column, so filtering is a straightforward eq(todos.completed).
- packages/contracts/src/index.ts: no query-param schema exists yet.
- apps/api/src/module/todo.routes.test.ts and todo.repository.test.ts: existing tests call listTodos(db) with no filter and GET /todos with no query string.

## Acceptance criteria
- GET /todos with no status param returns all todos with status 200.
- GET /todos?status=all returns all todos with status 200.
- GET /todos?status=active returns only todos where completed is false with status 200.
- GET /todos?status=completed returns only todos where completed is true with status 200.
- GET /todos?status=bogus returns 400 with a validationErrorResponseSchema body, no query hits the database.
- GET /todos?status=active&status=completed (duplicate param) returns 400, treated as an invalid value, not silently resolved to one of them.
- All existing unfiltered tests still pass.

## Contracts
### Input
What information enters the operation?
Optional status query string param on GET /todos. Accepted values: all, active, completed. Everything else, including duplicates, is invalid.

### Success
What exact value or visible result means success?
HTTP 200, body matches todoListResponseSchema, items filtered by the requested status (or unfiltered for all / omitted).

### Expected failures
| Failure | When it happens | How it is represented |
|---------|------------------|------------------------|
| Unknown status value | status is any string outside all/active/completed | HTTP 400, validationErrorResponseSchema body |
| Duplicate status param | Fastify parses status as an array (?status=a&status=b) | HTTP 400, validationErrorResponseSchema body |
| Repository database error | listTodos resolves Err({ type: "database", cause }) | HTTP 500, internalErrorResponseSchema body |
| Repository validation error | a stored row fails todoSchema | HTTP 500, internalErrorResponseSchema body |

### Unexpected failures
Not applicable

### Responsibilities
| Layer | Responsibility |
|-------|-----------------|
| Contract | packages/contracts owns a new todoStatusFilterSchema (enum of all/active/completed) used to validate the raw query value |
| Route | apps/api/src/module/todo.routes.ts parses request.query.status with todoStatusFilterSchema, rejects arrays/unknown values as 400, and passes the parsed filter to listTodos |
| Service or flow | Not applicable |
| Repository | apps/api/src/module/todo.repository.ts's listTodos(db, filter) adds a where(eq(todos.completed)) clause when filter is active or completed, no where clause for all |
| Hook / View | Not applicable |

## Certainty checks
### What information enters the system?
A single optional status query string, or nothing.

### How will you check that information?
A pure function, parseStatusFilter(rawQuery), rejects non-string values (arrays from duplicate params) and strings outside all/active/completed, returning a Result.

### What will the operation return when it succeeds?
HTTP 200 with items filtered per the Success section above.

### What expected failures can happen?
Invalid or duplicate status (400), repository DatabaseError/ValidationError (500). See Expected failures table.

### How will each expected failure be represented?
parseStatusFilter feeds into the existing toListTodosResponse-style mapping: a 400 branch returns validationErrorResponseSchema before touching the database; database/validation errors keep going through the existing internalErrorResponseSchema path.

### Where will the route, business rules, and database work live?
Query validation: apps/api/src/module/todo.routes.ts (parseStatusFilter) plus a new schema in packages/contracts/src/index.ts. Filtering: apps/api/src/module/todo.repository.ts's listTodos.

### What tests will you write before implementation?
Listed under "Tests to write first" below.

### How will you prove the whole operation works through its real boundaries?
Route-level tests via app.inject with real query strings against a disposable Postgres database, covering all four status values, omitted status, invalid status, and duplicate status.

### Does this change multiple records or call another system?
No.

### Frontend states
Not applicable

## Tests to write first
1. Contract unit test: todoStatusFilterSchema accepts "all", "active", "completed" and rejects "bogus" and an array.
2. Mapping unit test: parseStatusFilter(undefined) returns ok("all") (default).
3. Mapping unit test: parseStatusFilter("all"/"active"/"completed") returns ok(value).
4. Mapping unit test: parseStatusFilter("bogus") returns an err with a validation issue.
5. Mapping unit test: parseStatusFilter(["active", "completed"]) (duplicate param shape) returns an err.
6. Repository test: listTodos(db, "active") returns only incomplete todos after creating one completed and one active todo.
7. Repository test: listTodos(db, "completed") returns only completed todos.
8. Repository test: listTodos(db, "all") returns every todo, same as the existing no-filter behaviour.
9. Route integration test: GET /todos (no query) returns all todos — regression check.
10. Route integration test: GET /todos?status=all returns all todos.
11. Route integration test: GET /todos?status=active returns only active todos.
12. Route integration test: GET /todos?status=completed returns only completed todos.
13. Route integration test: GET /todos?status=bogus returns 400 with validationErrorResponseSchema body.
14. Route integration test: GET /todos?status=active&status=completed returns 400.

## Expected first failure
What exact behavioural failure should the first test show before implementation exists?
Before implementation: tests 1-5 fail with module-not-found (todoStatusFilterSchema / parseStatusFilter don't exist). Tests 6-8 fail because listTodos doesn't accept a filter argument yet. Tests 11-14 fail because the route ignores request.query and always returns everything with 200, never 400.

## Files expected to change
| File | Reason |
|------|--------|
| packages/contracts/src/index.ts | Add todoStatusFilterSchema (enum: all, active, completed) |
| apps/api/src/module/todo.repository.ts | listTodos(db, filter) adds a conditional where(eq(todos.completed, ...)) clause |
| apps/api/src/module/todo.repository.test.ts | Add filter tests, keep existing no-filter tests passing |
| apps/api/src/module/todo.routes.ts | Add parseStatusFilter, wire request.query.status through to listTodos, return 400 on invalid/duplicate values |
| apps/api/src/module/todo.routes.test.ts | Add parseStatusFilter unit tests and route integration tests for all status values plus invalid/duplicate cases |
| README.md | Document the status query param and its accepted values |

## Implementation steps
1. Add todoStatusFilterSchema to packages/contracts/src/index.ts.
2. Write repository filter tests in todo.repository.test.ts (should fail: listTodos has no filter param).
3. Update listTodos in todo.repository.ts to accept a filter and conditionally apply eq(todos.completed, ...).
4. Write parseStatusFilter unit tests in todo.routes.test.ts (should fail: function doesn't exist).
5. Implement parseStatusFilter in todo.routes.ts, defaulting to "all" and rejecting anything not in the enum, including arrays.
6. Wire GET /todos to call parseStatusFilter(request.query.status), return 400 on error, else call listTodos(db, filter).
7. Write route integration tests for all status values and the invalid/duplicate cases.
8. Update README.md with the new query param.

## Verification commands
```bash
pnpm docker:up
pnpm --filter api test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docker:down
```

## Risks and assumptions
- Assumes `all` is the correct default when `status` is omitted, rather than `active`. Flagging this for review rather than deciding it unilaterally.
- Assumes an invalid or duplicate `status` should hard-reject with 400, rather than silently falling back to `all`.
- Assumes exact lowercase matches only.

## Help already received
No

## Plan checklist
- [ ] The objective is small and clear.
- [ ] The branch name is included.
- [ ] The plan matches the requirements.
- [ ] The contracts are exact.
- [ ] Success and failure paths are covered.
- [ ] The tests come before implementation.
- [ ] The files and steps are specific.
- [ ] No production implementation has started.
- [ ] Material help and AI use are disclosed.
