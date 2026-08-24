Milestone Plan: M07
Milestone details
Item	Value
Milestone	M07
Capability	List GET/todos
Branch name	feat/m08-list-todos
Planned submission date	2026-08-23
Requirements	https://docs.google.com/document/d/1YWVyLVYAYmGd8dAM1T1oBoSHYM24Cj0oFqCnWNyhMuE/edit?tab=t.0

Objective: Plan the unfiltered list endpoint before adding filters, search, or pagination behaviour.

Included
GET /todos route in apps/api.
Ordering rule for the returned list.
A pure result-to-HTTP-response mapping function, unit-testable without a real database.
Explicit response contract for the todo list body.
Explicit error response contract for internal error.
Empty-list behaviour when no todos exist.

Not included
Filtering by completed status or any other field.
Search.
Pagination, limit, or offset behaviour.
POST, PATCH, or DELETE endpoints.
Frontend integration or UI.
Authentication or authorization.

Current repository evidence
What files, commands, or existing patterns did you inspect before making this plan?
packages/contracts/src/index.ts: todoSchema is the only schema defined.
apps/api/src/module/todo.repository.ts: listTodos(db) already exists and returns ResultAsync<Todo[], DatabaseError | ValidationError>. Its query is db.select().from(todos) with no ORDER BY clause.
apps/api/src/module/app.ts: buildApp() only registers GET /health and takes no arguments.
apps/api/src/module/index.ts: the only place a real db (apps/api/src/db/client.ts) is currently wired in.

Acceptance criteria
GET /todos returns 200 and a body that parses successfully with a new todoListResponseSchema.
GET /todos returns an empty array, not null and not an error, when the todos table has no rows.
GET /todos returns todos ordered by createdAt ascending, oldest first.
GET /todos returns 500 with a new internalErrorResponseSchema body when the repository returns Err(DatabaseError) or Err(ValidationError).
All verification commands listed below run successfully.

Contracts
Input
What information enters the operation?
None. GET /todos takes no request body, no query parameters, and no route parameters.

Success
What exact value or visible result means success?
HTTP 200. Content-Type: application/json. Body is a JSON array where every item matches packages/contracts's todoSchema, ordered by createdAt ascending.

Expected failures
Failure	When it happens	How it is represented
Repository database error	listTodos resolves Err({ type: "database", cause }): connection or query failure	HTTP 500, body { error: { type: "internal" } }, matches new internalErrorResponseSchema
Repository validation error	listTodos resolves Err({ type: "validation", issues }): a stored row fails todoSchema	HTTP 500, body { error: { type: "internal" } }, matches new internalErrorResponseSchema

Unexpected failures
What unexpected failures can reach this boundary? How will they be made safe for the caller or user?
Not applicable

Responsibilities
State what each relevant layer owns. Write Not applicable with a reason for unused layers.
Layer	Responsibility
Contract	packages/contracts owns the Todo shape (existing todoSchema) and the new todoListResponseSchema / internalErrorResponseSchema response shapes
Route or page	apps/api/src/module/todo.routes.ts owns HTTP concerns only: calling listTodos and mapping the Result to a status code and JSON body via the pure mapping function
Service or flow	Not applicable
Repository or API adapter	apps/api/src/module/todo.repository.ts's listTodos, including the ordering clause added to its query
Hook	Not applicable
View	Not applicable

Certainty checks
Answer each question. Use Not applicable with a short reason when needed.

What information enters the system?
None.

How will you check that information?
Not applicable

What will the operation return when it succeeds?
HTTP 200 with a JSON array of todos ordered by createdAt ascending. An empty array when no todos exist.

What expected failures can happen?
Repository DatabaseError (500), repository ValidationError on a stored row (500). See the Expected failures table above.

How will each expected failure be represented?
A pure function, toListTodosResponse(result), maps the repository's Result<Todo[], DatabaseError | ValidationError> to { status, body }. Each branch's body is asserted against its contract schema in tests: todoListResponseSchema for 200, internalErrorResponseSchema for 500s.

Where will the route, business rules, and database or UI work live?
Route + mapping function: apps/api/src/module/todo.routes.ts. Ordering: apps/api/src/module/todo.repository.ts's listTodos query. New response contracts: packages/contracts/src/index.ts.

What tests will you write before implementation?
Listed under "Tests to write first" below.

How will you prove the whole operation works through its real boundaries?
Route-level tests call app.inject({ method: "GET", url: "/todos" }) against a Fastify instance built with a real, disposable Postgres database.

Does this change multiple records or call another system? If yes, how will failure be handled safely?
No.

If this is frontend work, what loading, empty, ready, error, pending, and accessibility states are needed?
Not applicable

Tests to write first
List tests in the order you will write them. Include success and expected failure cases.
1. Mapping unit test: toListTodosResponse(ok([])) returns { status: 200, body: [] }, and the body parses with todoListResponseSchema.
2. Mapping unit test: toListTodosResponse(ok([todo])) returns { status: 200, body: [todo] }, and the body parses with todoListResponseSchema.
3. Mapping unit test: toListTodosResponse(err({ type: "database", cause })) returns { status: 500, body: { error: { type: "internal" } } }, and the body parses with internalErrorResponseSchema.
4. Mapping unit test: toListTodosResponse(err({ type: "validation", issues: [...] })) returns { status: 500, body: { error: { type: "internal" } } }.
5. Repository test: listTodos on an empty disposable database returns Ok([]).
6. Repository test: listTodos returns todos ordered by createdAt ascending after inserting them out of order.
7. Route integration test, real disposable database: GET /todos on an empty database returns 200 and [].
8. Route integration test: GET /todos after creating two todos returns 200 with both, ordered by createdAt ascending, and the body parses with todoListResponseSchema.

Expected first failure
What exact behavioural failure should the first test show before implementation exists?
Before any implementation exists: the mapping unit tests fail with a module-not-found error for apps/api/src/module/todo.routes.ts (toListTodosResponse doesn't exist yet). The ordering repository test fails because listTodos has no ORDER BY clause yet, so row order is not guaranteed. The route integration tests fail because GET /todos returns 404: buildApp() doesn't register that route yet, and buildApp doesn't yet accept a db argument to inject the disposable database into.

Files expected to change
File	Reason
packages/contracts/src/index.ts	Add todoListResponseSchema and internalErrorResponseSchema
apps/api/src/module/todo.repository.ts	Add an explicit ORDER BY createdAt ascending clause to listTodos's query
apps/api/src/module/todo.repository.test.ts	Add tests for empty list and ordering
apps/api/src/module/todo.routes.ts	New: toListTodosResponse mapping function and registerTodoRoutes(app, db)
apps/api/src/module/todo.routes.test.ts	New: mapping unit tests and route integration tests
apps/api/src/module/app.ts	buildApp now takes a db parameter and registers the todo routes
apps/api/src/module/app.test.ts	Update the health-check test to build the app with a disposable database, matching the new buildApp signature
apps/api/src/module/index.ts	Pass the real db from apps/api/src/db/client.ts into buildApp
README.md	Document the new endpoint and how to run its tests

Implementation steps
1. Add todoListResponseSchema and internalErrorResponseSchema to packages/contracts/src/index.ts.
2. Add an ORDER BY createdAt ascending clause to listTodos's query in apps/api/src/module/todo.repository.ts.
3. Write the repository tests for empty list and ordering in apps/api/src/module/todo.repository.test.ts (they should fail until step 2 is done).
4. Write the mapping unit tests in apps/api/src/module/todo.routes.test.ts (they should fail: module doesn't exist).
5. Write toListTodosResponse in apps/api/src/module/todo.routes.ts to make the mapping tests pass.
6. Write registerTodoRoutes(app, db) in the same file, wiring listTodos and toListTodosResponse together for GET /todos.
7. Change buildApp in apps/api/src/module/app.ts to accept a db parameter and call registerTodoRoutes.
8. Update apps/api/src/module/index.ts to pass the real db into buildApp.
9. Update apps/api/src/module/app.test.ts to supply a disposable database to buildApp.
10. Write the route integration tests in apps/api/src/module/todo.routes.test.ts against a disposable database.
11. Update README.md.

Verification commands
pnpm docker:up
pnpm --filter api test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docker:down

Risks and assumptions
Assumes createdAt ascending, oldest first, is the right default ordering for an unfiltered list. Flagging this for review rather than deciding it unilaterally.
Assumes a generic { error: { type: "internal" } } body with no message or cause is enough information for a client to branch on, without leaking implementation details.
Assumes an empty array, not a 404, is correct for a list endpoint with zero rows.

Help already received
No

Plan checklist
☐ The objective is small and clear.
☐ The branch name is included.
☐ The plan matches the requirements.
☐ The contracts are exact.
☐ Success and failure paths are covered.
☐ The tests come before implementation.
☐ The files and steps are specific.
☐ No production implementation has started.
☐ Material help and AI use are disclosed.
