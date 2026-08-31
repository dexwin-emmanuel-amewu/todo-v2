import {
  type InternalErrorResponse,
  type Todo,
  type TodoListResponse,
  type TodoStatusFilter,
  todoListResponseSchema,
  todoSearchQuerySchema,
  todoStatusFilterSchema,
} from "@todo/contracts";
import type { FastifyInstance } from "fastify";
import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";

import type { DatabaseError, ValidationError } from "../db/errors.js";
import type { Db } from "./todo.repository.js";
import { listTodos } from "./todo.repository.js";
import { createTodoFlow, type RequestValidationError } from "./todo.service.js";

const internalErrorBody: InternalErrorResponse = { error: { type: "internal" } };

export function toCreateTodoResponse(
  result: Result<Todo, RequestValidationError | ValidationError | DatabaseError>,
): { status: number; body: unknown } {
  if (result.isOk()) {
    return { status: 201, body: result.value };
  }

  if (result.error.type === "request_validation") {
    return {
      status: 400,
      body: { error: { type: "validation", issues: result.error.issues } },
    };
  }

  return { status: 500, body: internalErrorBody };
}

type ListTodosResponse =
  { status: 200; body: TodoListResponse } | { status: 500; body: InternalErrorResponse };

export function toListTodosResponse(
  result: Result<Todo[], DatabaseError | ValidationError>,
): ListTodosResponse {
  if (result.isErr()) {
    return { status: 500, body: internalErrorBody };
  }

  const body: TodoListResponse = { items: result.value };
  const validated = todoListResponseSchema.safeParse(body);

  if (!validated.success) {
    return { status: 500, body: internalErrorBody };
  }

  return { status: 200, body: validated.data };
}

type QueryValidationError = { type: "request_validation"; issues: string[] };

export function parseStatusFilter(
  rawStatus: unknown,
): Result<TodoStatusFilter, QueryValidationError> {
  return match(rawStatus)
    .with(undefined, (): Result<TodoStatusFilter, QueryValidationError> => ok("all"))
    .otherwise((value) => {
      const parsed = todoStatusFilterSchema.safeParse(value);

      return match(parsed)
        .with({ success: true }, ({ data }): Result<TodoStatusFilter, QueryValidationError> =>
          ok(data),
        )
        .with({ success: false }, ({ error }): Result<TodoStatusFilter, QueryValidationError> =>
          err({
            type: "request_validation",
            issues: error.issues.map((issue) => issue.message),
          }),
        )
        .exhaustive();
    });
}

export function parseSearchQuery(
  rawSearch: unknown,
): Result<string | undefined, QueryValidationError> {
  return match(rawSearch)
    .with(undefined, (): Result<string | undefined, QueryValidationError> => ok(undefined))
    .otherwise((value) => {
      const parsed = todoSearchQuerySchema.safeParse(value);

      return match(parsed)
        .with({ success: true }, ({ data }): Result<string | undefined, QueryValidationError> =>
          ok(data === "" ? undefined : data),
        )
        .with({ success: false }, ({ error }): Result<string | undefined, QueryValidationError> =>
          err({
            type: "request_validation",
            issues: error.issues.map((issue) => issue.message),
          }),
        )
        .exhaustive();
    });
}

export function registerTodoRoutes(app: FastifyInstance, db: Db): void {
  app.post("/todos", async (request, reply) => {
    const result = await createTodoFlow(db, request.body);

    if (result.isErr() && result.error.type !== "request_validation") {
      request.log.error({ err: result.error }, "POST /todos failed");
    }

    const { status, body } = toCreateTodoResponse(result);
    return reply.code(status).send(body);
  });

  app.get("/todos", async (request, reply) => {
    const query = request.query as { status?: unknown; search?: unknown };
    const filterResult = parseStatusFilter(query.status);
    const searchResult = parseSearchQuery(query.search);

    if (filterResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: filterResult.error.issues } });
    }

    if (searchResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: searchResult.error.issues } });
    }

    const result = await listTodos(db, filterResult.value, searchResult.value);
    const { status, body } = toListTodosResponse(result);
    return reply.status(status).send(body);
  });
}
