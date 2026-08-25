Milestone Plan — M05
Milestone details
Item	Value
Milestone	M05
Capability	Create POST/todo
Branch name	feat/m06-create-todo
Planned submission date	2026-08-20
Requirements	https://docs.google.com/document/d/1YWVyLVYAYmGd8dAM1T1oBoSHYM24Cj0oFqCnWNyhMuE/edit?tab=t.0

Objective
Plan how a client creates one todo.

Included
POST /todos route in apps/api.
Request body validation against packages/contracts's createTodoSchema.
A pure result-to-HTTP-response mapping function, unit-testable without a real database.
Explicit error response contracts for validation error, internal error.

Not included
GET, PATCH, or DELETE endpoints.
Frontend integration or UI.
Authentication or authorization.

Current repository evidence
What files, commands, or existing patterns did you inspect before making this plan?
packages/contracts/src/index.ts.
apps/api/src/db/errors.ts: DatabaseError, ValidationError, NotFoundError are the existing typed error shapes; nothing new needed at the repository layer.
apps/api/src/module/app.ts: buildApp() currently only registers GET /health and takes no dependencies.
apps/api/src/module/index.ts: the only place a real db (apps/api/src/db/client.ts) is currently wired in.

Acceptance criteria
POST /todos with a valid title returns 201 and a body that parses successfully with packages/contracts's todoSchema.
POST /todos with an invalid title (too short, too long, wrong type) returns 400 and a body that parses successfully with a new validationErrorResponseSchema.
POST /todos returns 500 with a new internalError body when the repository returns Err(DatabaseError) or Err(ValidationError).
All verification commands listed below run successfully.

Contracts
Input
What information enters the operation?
An HTTP POST request to /todos with a JSON body.

Success
What exact value or visible result means success?
HTTP 201 Created. Content-Type: application/json. Body is the created Todo that matches packages/contracts's todoSchema exactly: { id: uuid, title: string, completed: false, createdAt: ISO datetime string }.

Expected failures
Failure	When it happens	How it is represented
Invalid request body	request.body fails createTodoSchema.safeParse (title missing, not a string, under 6 chars, or over 100 chars)	HTTP 400, body { error: { type: "validation", issues: string[] } }, matches new validationErrorResponseSchema
Malformed JSON body	Fastify's built-in JSON body parser cannot parse the request body	HTTP 400 (Fastify's default parser error), verified by test but not custom-formatted this milestone
Repository database error	createTodo resolves Err({ type: "database", cause }) — connection or query failure	HTTP 500, body { error: { type: "internal" } }
Repository validation error	createTodo resolves Err({ type: "validation", issues })	HTTP 500, body { error: { type: "internal" } };

Unexpected failures
What unexpected failures can reach this boundary? How will they be made safe for the caller or user?

Responsibilities
State what each relevant layer owns. Write Not applicable with a reason for unused layers.
Layer	Responsibility
Contract	packages/contracts owns the Todo/CreateTodoInput shapes (existing) and the new validationErrorResponseSchema / internalErrorResponseSchema response shapes
Route or page	apps/api/src/module/todo.routes.ts owns HTTP concerns only: parsing the request body, running it through createTodoSchema, calling createTodo, and mapping the Result to a status code and JSON body via the pure mapping function
Service or flow	Not applicable 
Repository or API adapter	apps/api/src/module/todo.repository.ts's createTodo 
Hook	Not applicable
View	Not applicable

Certainty checks
Answer each question. Use Not applicable with a short reason when needed.

What information enters the system?
An HTTP POST body with a title field.

How will you check that information?
createTodoSchema.safeParse(request.body) in the route, before the repository is ever called.

What will the operation return when it succeeds?
HTTP 201 with a JSON body.

What expected failures can happen?
Invalid request body (400), repository DatabaseError (500), repository ValidationError on the stored row (500). See the Expected failures table above.

How will each expected failure be represented?
A pure function, toCreateTodoResponse(result), maps the repository's Result<Todo, DatabaseError | ValidationError> (plus the earlier request-validation outcome) to { status, body }. Each branch's body is asserted against its contract schema in tests — validationErrorResponseSchema for 400s, internalErrorResponseSchema for 500s — so response validation is checked on every path, not just the success path.

Where will the route, business rules, and database or UI work live?
Route + mapping function: apps/api/src/module/todo.routes.ts. Repository: apps/api/src/module/todo.repository.ts. New response contracts: packages/contracts/src/index.ts.

What tests will you write before implementation?

How will you prove the whole operation works through its real boundaries?
Route-level tests call app.inject({ method: "POST", url: "/todos" }) against a Fastify instance built with a real, disposable Postgres database.

Does this change multiple records or call another system? If yes, how will failure be handled safely?
No

If this is frontend work, what loading, empty, ready, error, pending, and accessibility states are needed?
Not applicable — backend-only milestone.

Tests to write first
List tests in the order you will write them. Include success and expected failure cases.
1. Mapping unit test — toCreateTodoResponse(ok(todo)) returns { status: 201, body: todo }, and the body parses with todoSchema.
2. Mapping unit test — toCreateTodoResponse(err({ type: "database", cause })) returns { status: 500, body: { error: { type: "internal" } } }, and the body parses with internalErrorResponseSchema.
3. Mapping unit test — toCreateTodoResponse(err({ type: "validation", issues: [...] })) returns { status: 500, body: { error: { type: "internal" } } } (stored-row validation failure is still an internal error, not a 400).
4. Route integration test (real disposable database) — POST /todos with a valid title returns 201 and a body that parses with todoSchema.
5. Route integration test — POST /todos with title "hi" (5 chars, under the 6-char minimum) returns 400 and a body that parses with validationErrorResponseSchema.
6. Route integration test — POST /todos with no title field returns 400.
7. Route integration test — POST /todos with a malformed JSON body returns 400.

Expected first failure
What exact behavioural failure should the first test show before implementation exists?
Before any implementation exists: the mapping unit tests fail with a module-not-found error for apps/api/src/module/todo.routes.ts (toCreateTodoResponse doesn't exist yet). The route integration tests fail because POST /todos returns 404 — buildApp() doesn't register that route yet, and buildApp doesn't yet accept a db argument to inject the disposable database into.

Files expected to change
File	Reason
packages/contracts/src/index.ts	Add validationErrorResponseSchema and internalErrorResponseSchema
apps/api/src/module/todo.routes.ts	New: toCreateTodoResponse mapping function and registerTodoRoutes(app, db)
apps/api/src/module/todo.routes.test.ts	New: mapping unit tests and route integration tests
apps/api/src/module/app.ts	buildApp now takes a db parameter and registers the todo routes
apps/api/src/module/app.test.ts	Update the health-check test to build the app with a disposable database, matching the new buildApp signature
apps/api/src/module/index.ts	Pass the real db from apps/api/src/db/client.ts into buildApp
README.md	Document the new endpoint and how to run its tests

Implementation steps
Add validationErrorResponseSchema and internalErrorResponseSchema to packages/contracts/src/index.ts.
Write the mapping unit tests in apps/api/src/module/todo.routes.test.ts (they should fail — module doesn't exist).
Write toCreateTodoResponse in apps/api/src/module/todo.routes.ts to make the mapping tests pass.
Write registerTodoRoutes(app, db) in the same file, wiring request-body validation, createTodo, and toCreateTodoResponse together.
Change buildApp in apps/api/src/module/app.ts to accept a db parameter and call registerTodoRoutes.
Update apps/api/src/module/index.ts to pass the real db into buildApp.
Update apps/api/src/module/app.test.ts to supply a disposable database to buildApp.
Write the route integration tests in apps/api/src/module/todo.routes.test.ts against a disposable database.
Update README.md.

Verification commands
pnpm docker:up
pnpm --filter api test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docker:down

Risks and assumptions
Assumes a generic { error: { type: "internal" } } body with no message or cause is the right amount of information to expose on a 500 which is enough for a client to branch on, not enough to leak implementation details.

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
