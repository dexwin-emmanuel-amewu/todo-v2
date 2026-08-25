import { createTodoSchema, type Todo } from "@todo/contracts";
import { errAsync, type ResultAsync } from "neverthrow";

import type { DatabaseError, ValidationError } from "../db/errors.js";
import { createTodo, type Db } from "./todo.repository.js";

export type RequestValidationError = { type: "request_validation"; issues: string[] };

export function createTodoFlow(
  db: Db,
  rawInput: unknown,
): ResultAsync<Todo, RequestValidationError | ValidationError | DatabaseError> {
  const parsed = createTodoSchema.safeParse(rawInput);

  if (!parsed.success) {
    return errAsync({
      type: "request_validation",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }

  return createTodo(db, parsed.data);
}
