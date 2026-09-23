import {
  createTodoSchema,
  patchTodoSchema,
  replaceTodoSchema,
  setAllTodosCompletedSchema,
  type Todo,
} from "@todo/contracts";
import { errAsync, type ResultAsync } from "neverthrow";

import type { DatabaseError, NotFoundError, ValidationError } from "../db/errors.js";
import {
  createTodo,
  type Db,
  patchTodoById,
  replaceTodoById,
  setAllTodosCompleted,
} from "./todo.repository.js";

export type RequestValidationError = { type: "request_validation"; issues: string[] };

export function createTodoService(
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

export function replaceTodoService(
  db: Db,
  id: string,
  rawInput: unknown,
): ResultAsync<Todo, RequestValidationError | NotFoundError | ValidationError | DatabaseError> {
  const parsed = replaceTodoSchema.safeParse(rawInput);

  if (!parsed.success) {
    return errAsync({
      type: "request_validation",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }

  return replaceTodoById(db, id, parsed.data);
}

export function patchTodoService(
  db: Db,
  id: string,
  rawInput: unknown,
): ResultAsync<Todo, RequestValidationError | NotFoundError | ValidationError | DatabaseError> {
  const parsed = patchTodoSchema.safeParse(rawInput);

  if (!parsed.success) {
    return errAsync({
      type: "request_validation",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }

  return patchTodoById(db, id, parsed.data);
}

export function setAllTodosCompletedService(
  db: Db,
  rawInput: unknown,
): ResultAsync<{ updatedCount: number }, RequestValidationError | DatabaseError> {
  const parsed = setAllTodosCompletedSchema.safeParse(rawInput);

  if (!parsed.success) {
    return errAsync({
      type: "request_validation",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }

  return setAllTodosCompleted(db, parsed.data.completed);
}
