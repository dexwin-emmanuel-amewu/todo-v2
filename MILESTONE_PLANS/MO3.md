Milestone Plan — M03
Milestone details
Item	Value
Milestone	M03
Capability	Database
Branch name	feat/m04-todo-database-foundation
Planned submission date 2026-08-18
Requirements	https://docs.google.com/document/d/1YWVyLVYAYmGd8dAM1T1oBoSHYM24Cj0oFqCnWNyhMuE/edit?tab=t.0

Objective: Define the todo data model, initial migration, database boundary, and migration proof.

Included
Todo fields and constraints.
Drizzle schema source for the todos table.
A generated migration process via drizzle-kit.
PostgreSQL connection built from injected env configuration.
Database-record validation.
Repository boundary returning typed neverthrow Results with explicit error types, never a thrown exception.
A disposable database used to prove the migration applies cleanly from scratch.
Docker Compose.
Tests proving the migration and repository work against a real database and the exact commands to run them.

Not included
Endpoints for the todo model.
Frontend integration or UI.
Update and delete operations.
Authentication or authorization.

Current repository evidence
What files, commands, or existing patterns did you inspect before making this plan?
packages/contracts/src/index.ts — the existing todoSchema/createTodoSchema (id uuid, title string 6-100 chars, completed boolean, createdAt ISO datetime string).

Acceptance criteria
Drizzle schema, generated migration, and repository code typecheck and lint cleanly.
Running the generated migration against a disposable PostgreSQL container succeeds with no errors and produces a todos table matching the schema.
Repository functions insert and read back a todo whose shape matches packages/contracts's todoSchema.
Repository returns a typed error (not a thrown exception) for a not-found id.
All verification commands listed below run successfully.

Contracts
Input
None

What information enters the operation?
None

Success
What exact value or visible result means success?
Repository functions return Ok(Todo) (or Ok(Todo[]) for list) where the value satisfies packages/contracts's todoSchema. The migration applies against a fresh database with no errors and leaves a todos table matching the schema.

Expected failures
Failure	When it happens	How it is represented
Not found	get-by-id is called with an id that has no matching row	Err(NotFoundError)
Invalid stored row	A row read back from the database fails todoSchema validation	Err(ValidationError)
Connection or query failure	PostgreSQL is unreachable, or a query fails	Err(DatabaseError)

Unexpected failures
What unexpected failures can reach this boundary? How will they be made safe for the caller or user?
A dropped connection mid-query or an exhausted pool. These surface as Err(DatabaseError) from the repository rather than an unhandled rejection, so the caller decides what happens next instead of the process crashing.

Responsibilities
State what each relevant layer owns. Write Not applicable with a reason for unused layers.
Layer	Responsibility
Contract	packages/contracts owns the Todo shape and validation rules (todoSchema, createTodoSchema)
Route or page	Not applicable
Service or flow	Not applicable
Repository or API adapter	apps/api/src/db owns the Drizzle schema, the generated migration, the PostgreSQL client, and the todos repository (queries, error mapping, record validation)
Hook	Not applicable
View	Not applicable

Certainty checks
Answer each question. Use Not applicable with a short reason when needed.

What information enters the system?
None

How will you check that information?
createTodoSchema validates a create payload before it reaches the database. todoSchema validates every row read back from the database before it's returned to a caller. env.ts validates DATABASE_URL is present and well-formed at startup.

What will the operation return when it succeeds?
Ok(Todo) for create and Ok(Todo[]) for list.

What expected failures can happen?
Not found on get-by-id, an invalid stored row, a database connection or query failure.

How will each expected failure be represented?
A neverthrow Result with a specific error type per case (NotFoundError, ValidationError, DatabaseError). Never a thrown exception crossing the repository boundary.

Where will the route, business rules, and database or UI work live?
Schema: apps/api/src/db/schema.ts. Migration config: apps/api/drizzle.config.ts, generated output in apps/api/drizzle. Client: apps/api/src/db/client.ts. Repository: apps/api/src/db/todos-repository.ts. No routes or UI in this milestone.

What tests will you write before implementation?
Listed under "Tests to write first" below.

How will you prove the whole operation works through its real boundaries?
Run the generated migration against a real, disposable PostgreSQL container started via Docker Compose, then exercise the repository against that same running database. No mocked database client.

Does this change multiple records or call another system? If yes, how will failure be handled safely?

If this is frontend work, what loading, empty, ready, error, pending, and accessibility states are needed?
Not applicable

Tests to write first
List tests in the order you will write them. Include success and expected failure cases.
1. Migration proof — apply the generated migration to a fresh, disposable database and assert the todos table exists with the expected columns and types.
2. Repository not found: get an id that was never inserted, assert Err(NotFoundError).

Expected first failure
What exact behavioural failure should the first test show before implementation exists?
Before any implementation exists, these tests fail because the code they depend on doesn't exist yet: module-not-found errors for apps/api/src/db/schema.ts and apps/api/src/db/todos-repository.ts, and there is no todos table for the migration test to check.

Files expected to change
File	Reason
apps/api/src/db/schema.ts	Drizzle table definition for todos
apps/api/drizzle.config.ts	drizzle-kit configuration (schema path, output folder, connection)
apps/api/drizzle/	Generated migration SQL and metadata, committed to the repo
apps/api/src/db/client.ts	PostgreSQL pool and Drizzle instance built from env.DATABASE_URL
apps/api/src/db/todos-repository.ts	Repository functions (create, getById, list) and error types
apps/api/src/db/todos-repository.test.ts	Repository tests run against a real disposable database
apps/api/src/db/migration.test.ts	Migration-proof test
apps/api/src/env.ts	Add DATABASE_URL back to the validated env schema
docker-compose.yml	PostgreSQL service for local development and the disposable test database
package.json	db:generate / db:migrate / docker:up / docker:down scripts
README.md	Document database setup, Docker usage, and verification commands

Implementation steps
Add docker-compose.yml with a PostgreSQL service.
Add DATABASE_URL to apps/api/src/env.ts.
Write apps/api/src/db/schema.ts to match packages/contracts's todoSchema (id uuid primary key, title text, completed boolean default false, createdAt timestamptz default now()).
Add apps/api/drizzle.config.ts.
Generate the initial migration with drizzle-kit and commit it.
Write apps/api/src/db/client.ts.
Write apps/api/src/db/todos-repository.ts with typed errors and record validation.
Write the migration-proof test.
Write the repository tests.
Update README.md with database setup, Docker usage, and verification commands.
Verification commands
pnpm docker:up
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docker:down

Risks and assumptions
Assumes a local Docker daemon is available to run the disposable PostgreSQL instance.
Assumes Zod validation is sufficient for this milestone and does not need to be duplicated as PostgreSQL CHECK constraints — flagging this for review rather than deciding it unilaterally.
No CI is configured yet, so "migration proof" currently means running it locally against Docker. If CI is added later, it will need the same PostgreSQL service available.

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
