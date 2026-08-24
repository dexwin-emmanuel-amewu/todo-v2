import { type CreateTodoInput, type Todo, todoSchema } from "@todo/contracts";
import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { err, ok, type Result, ResultAsync } from "neverthrow";

import type { DatabaseError, NotFoundError, ValidationError } from "../db/errors.js";
import { todos } from "../db/schema.js";
import type * as schema from "../db/schema.js";

type Db = NodePgDatabase<typeof schema>;

function toDatabaseError(cause: unknown): DatabaseError {
  return { type: "database", cause };
}

function toRow(row: typeof todos.$inferSelect): Result<Todo, ValidationError> {
  const parsed = todoSchema.safeParse({
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
  });

  return parsed.success
    ? ok(parsed.data)
    : err({ type: "validation", issues: parsed.error.issues.map((issue) => issue.message) });
}

export function createTodo(
  db: Db,
  input: CreateTodoInput,
): ResultAsync<Todo, DatabaseError | ValidationError> {
  return ResultAsync.fromPromise(
    db
      .insert(todos)
      .values({ title: input.title })
      .returning()
      .then((rows) => rows[0]!),
    toDatabaseError,
  ).andThen(toRow);
}

export function getTodoById(
  db: Db,
  id: string,
): ResultAsync<Todo, DatabaseError | NotFoundError | ValidationError> {
  return ResultAsync.fromPromise(
    db.select().from(todos).where(eq(todos.id, id)).limit(1),
    toDatabaseError,
  ).andThen((rows) => {
    const row = rows[0];
    return row ? toRow(row) : err<Todo, NotFoundError>({ type: "not_found", id });
  });
}

export function listTodos(db: Db): ResultAsync<Todo[], DatabaseError | ValidationError> {
  return ResultAsync.fromPromise(
    db.select().from(todos).orderBy(asc(todos.createdAt), asc(todos.id)),
    toDatabaseError,
  ).andThen((rows) => {
    const result: Todo[] = [];

    for (const row of rows) {
      const validated = toRow(row);
      if (validated.isErr()) {
        return err(validated.error);
      }
      result.push(validated.value);
    }

    return ok(result);
  });
}
