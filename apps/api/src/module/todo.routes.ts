import {
  type InternalErrorResponse,
  type NotFoundErrorResponse,
  type Todo,
  type TodoListResponse,
  type TodoStatusFilter,
  todoIdParamSchema,
  todoListResponseSchema,
  todoPageQuerySchema,
  todoPageSizeQuerySchema,
  todoSchema,
  todoSearchQuerySchema,
  todoStatusFilterSchema,
} from "@todo/contracts";
import type { FastifyInstance } from "fastify";
import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";
import type { z } from "zod";

import type { DatabaseError, NotFoundError, ValidationError } from "../db/errors.js";
import type { Db, PaginatedTodos, TodoPagination } from "./todo.repository.js";
import { getTodoById, listTodos } from "./todo.repository.js";
import { createTodoFlow, type RequestValidationError } from "./todo.service.js";

const internalErrorBody: InternalErrorResponse = { error: { type: "internal" } };
const notFoundErrorBody: NotFoundErrorResponse = { error: { type: "not_found" } };

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
  result: Result<PaginatedTodos, DatabaseError | ValidationError>,
): ListTodosResponse {
  if (result.isErr()) {
    return { status: 500, body: internalErrorBody };
  }

  const body: TodoListResponse = result.value;
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

const defaultPage = 1;
const defaultPageSize = 20;

function parsePaginationField(
  rawValue: unknown,
  defaultValue: number,
  schema: z.ZodType<number>,
): Result<number, QueryValidationError> {
  return match(rawValue)
    .with(undefined, (): Result<number, QueryValidationError> => ok(defaultValue))
    .otherwise((value) => {
      if (typeof value !== "string") {
        return err<number, QueryValidationError>({
          type: "request_validation",
          issues: ["expected a single value"],
        });
      }

      const parsed = schema.safeParse(value);

      return match(parsed)
        .with({ success: true }, ({ data }): Result<number, QueryValidationError> => ok(data))
        .with({ success: false }, ({ error }): Result<number, QueryValidationError> =>
          err({
            type: "request_validation",
            issues: error.issues.map((issue) => issue.message),
          }),
        )
        .exhaustive();
    });
}

export function parsePagination(
  rawPage: unknown,
  rawPageSize: unknown,
): Result<TodoPagination, QueryValidationError> {
  const pageResult = parsePaginationField(rawPage, defaultPage, todoPageQuerySchema);
  if (pageResult.isErr()) {
    return err(pageResult.error);
  }

  const pageSizeResult = parsePaginationField(
    rawPageSize,
    defaultPageSize,
    todoPageSizeQuerySchema,
  );
  if (pageSizeResult.isErr()) {
    return err(pageSizeResult.error);
  }

  return ok({ page: pageResult.value, pageSize: pageSizeResult.value });
}

export function parseTodoId(rawId: unknown): Result<string, QueryValidationError> {
  const parsed = todoIdParamSchema.safeParse(rawId);

  return match(parsed)
    .with({ success: true }, ({ data }): Result<string, QueryValidationError> => ok(data))
    .with({ success: false }, ({ error }): Result<string, QueryValidationError> =>
      err({
        type: "request_validation",
        issues: error.issues.map((issue) => issue.message),
      }),
    )
    .exhaustive();
}

type GetTodoResponse =
  | { status: 200; body: Todo }
  | { status: 404; body: NotFoundErrorResponse }
  | { status: 500; body: InternalErrorResponse };

export function toGetTodoResponse(
  result: Result<Todo, NotFoundError | ValidationError | DatabaseError>,
): GetTodoResponse {
  if (result.isOk()) {
    const validated = todoSchema.safeParse(result.value);

    return validated.success
      ? { status: 200, body: validated.data }
      : { status: 500, body: internalErrorBody };
  }

  return match(result.error)
    .with({ type: "not_found" }, (): GetTodoResponse => ({ status: 404, body: notFoundErrorBody }))
    .with({ type: "validation" }, { type: "database" }, (): GetTodoResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
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
    const query = request.query as {
      status?: unknown;
      search?: unknown;
      page?: unknown;
      pageSize?: unknown;
    };
    const filterResult = parseStatusFilter(query.status);
    const searchResult = parseSearchQuery(query.search);
    const paginationResult = parsePagination(query.page, query.pageSize);

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

    if (paginationResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: paginationResult.error.issues } });
    }

    const result = await listTodos(
      db,
      filterResult.value,
      searchResult.value,
      paginationResult.value,
    );
    const { status, body } = toListTodosResponse(result);
    return reply.status(status).send(body);
  });

  app.get("/todos/:todoId", async (request, reply) => {
    const params = request.params as { todoId?: unknown };
    const idResult = parseTodoId(params.todoId);

    if (idResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: idResult.error.issues } });
    }

    const result = await getTodoById(db, idResult.value);

    if (result.isErr() && result.error.type !== "not_found") {
      request.log.error({ err: result.error }, "GET /todos/:todoId failed");
    }

    const { status, body } = toGetTodoResponse(result);
    return reply.status(status).send(body);
  });
}
