import {
  type ClearCompletedTodosResponse,
  type InternalErrorResponse,
  type NotFoundErrorResponse,
  type SetAllTodosCompletedResponse,
  type Todo,
  type TodoListResponse,
  type TodoStatusFilter,
  clearCompletedTodosResponseSchema,
  setAllTodosCompletedResponseSchema,
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
import { deleteCompletedTodos, deleteTodoById, getTodoById, listTodos } from "./todo.repository.js";
import {
  createTodoService,
  patchTodoService,
  replaceTodoService,
  type RequestValidationError,
  setAllTodosCompletedService,
} from "./todo.service.js";

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

export function parseDeleteCompletedSelector(
  rawStatus: unknown,
  rawSearch: unknown,
  rawPage: unknown,
  rawPageSize: unknown,
): Result<void, QueryValidationError> {
  const unsupported = (
    [
      ["search", rawSearch],
      ["page", rawPage],
      ["pageSize", rawPageSize],
    ] as const
  )
    .filter(([, value]) => value !== undefined)
    .map(([name]) => `${name} is not supported on DELETE /todos`);

  if (unsupported.length > 0) {
    return err({ type: "request_validation", issues: unsupported });
  }

  if (rawStatus === undefined) {
    return err({
      type: "request_validation",
      issues: ["status is required and must be completed"],
    });
  }

  if (rawStatus !== "completed") {
    return err({ type: "request_validation", issues: ["status must be completed"] });
  }

  return ok(undefined);
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

type ReplaceTodoResponse =
  | { status: 200; body: Todo }
  | { status: 400; body: { error: { type: "validation"; issues: string[] } } }
  | { status: 404; body: NotFoundErrorResponse }
  | { status: 500; body: InternalErrorResponse };

export function toReplaceTodoResponse(
  result: Result<Todo, RequestValidationError | NotFoundError | ValidationError | DatabaseError>,
): ReplaceTodoResponse {
  if (result.isOk()) {
    const validated = todoSchema.safeParse(result.value);

    return validated.success
      ? { status: 200, body: validated.data }
      : { status: 500, body: internalErrorBody };
  }

  return match(result.error)
    .with({ type: "request_validation" }, ({ issues }): ReplaceTodoResponse => ({
      status: 400,
      body: { error: { type: "validation", issues } },
    }))
    .with({ type: "not_found" }, (): ReplaceTodoResponse => ({
      status: 404,
      body: notFoundErrorBody,
    }))
    .with({ type: "validation" }, { type: "database" }, (): ReplaceTodoResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
}

type PatchTodoResponse =
  | { status: 200; body: Todo }
  | { status: 400; body: { error: { type: "validation"; issues: string[] } } }
  | { status: 404; body: NotFoundErrorResponse }
  | { status: 500; body: InternalErrorResponse };

export function toPatchTodoResponse(
  result: Result<Todo, RequestValidationError | NotFoundError | ValidationError | DatabaseError>,
): PatchTodoResponse {
  if (result.isOk()) {
    const validated = todoSchema.safeParse(result.value);

    return validated.success
      ? { status: 200, body: validated.data }
      : { status: 500, body: internalErrorBody };
  }

  return match(result.error)
    .with({ type: "request_validation" }, ({ issues }): PatchTodoResponse => ({
      status: 400,
      body: { error: { type: "validation", issues } },
    }))
    .with({ type: "not_found" }, (): PatchTodoResponse => ({
      status: 404,
      body: notFoundErrorBody,
    }))
    .with({ type: "validation" }, { type: "database" }, (): PatchTodoResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
}

type SetAllTodosCompletedRouteResponse =
  | { status: 200; body: SetAllTodosCompletedResponse }
  | { status: 400; body: { error: { type: "validation"; issues: string[] } } }
  | { status: 500; body: InternalErrorResponse };

export function toSetAllTodosCompletedResponse(
  result: Result<{ updatedCount: number }, RequestValidationError | DatabaseError>,
): SetAllTodosCompletedRouteResponse {
  if (result.isOk()) {
    const validated = setAllTodosCompletedResponseSchema.safeParse(result.value);

    return validated.success
      ? { status: 200, body: validated.data }
      : { status: 500, body: internalErrorBody };
  }

  return match(result.error)
    .with({ type: "request_validation" }, ({ issues }): SetAllTodosCompletedRouteResponse => ({
      status: 400,
      body: { error: { type: "validation", issues } },
    }))
    .with({ type: "database" }, (): SetAllTodosCompletedRouteResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
}

type ClearCompletedTodosRouteResponse =
  | { status: 200; body: ClearCompletedTodosResponse }
  | { status: 400; body: { error: { type: "validation"; issues: string[] } } }
  | { status: 500; body: InternalErrorResponse };

export function toClearCompletedTodosResponse(
  result: Result<{ deletedCount: number }, RequestValidationError | DatabaseError>,
): ClearCompletedTodosRouteResponse {
  if (result.isOk()) {
    const validated = clearCompletedTodosResponseSchema.safeParse(result.value);

    return validated.success
      ? { status: 200, body: validated.data }
      : { status: 500, body: internalErrorBody };
  }

  return match(result.error)
    .with({ type: "request_validation" }, ({ issues }): ClearCompletedTodosRouteResponse => ({
      status: 400,
      body: { error: { type: "validation", issues } },
    }))
    .with({ type: "database" }, (): ClearCompletedTodosRouteResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
}

type DeleteTodoResponse =
  | { status: 204; body: undefined }
  | { status: 404; body: NotFoundErrorResponse }
  | { status: 500; body: InternalErrorResponse };

export function toDeleteTodoResponse(
  result: Result<void, NotFoundError | DatabaseError>,
): DeleteTodoResponse {
  if (result.isOk()) {
    return { status: 204, body: undefined };
  }

  return match(result.error)
    .with({ type: "not_found" }, (): DeleteTodoResponse => ({
      status: 404,
      body: notFoundErrorBody,
    }))
    .with({ type: "database" }, (): DeleteTodoResponse => ({
      status: 500,
      body: internalErrorBody,
    }))
    .exhaustive();
}

export function registerTodoRoutes(app: FastifyInstance, db: Db): void {
  app.post("/todos", async (request, reply) => {
    const result = await createTodoService(db, request.body);

    if (result.isErr() && result.error.type !== "request_validation") {
      const message =
        result.error.type === "validation"
          ? "POST /todos: stored row failed validation"
          : "POST /todos: database error";
      request.log.error({ err: result.error }, message);
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

    if (result.isErr()) {
      const message =
        result.error.type === "validation"
          ? "GET /todos: stored row failed validation"
          : "GET /todos: database error";
      request.log.error({ err: result.error }, message);
    }

    const { status, body } = toListTodosResponse(result);
    return reply.status(status).send(body);
  });

  app.patch("/todos", async (request, reply) => {
    const result = await setAllTodosCompletedService(db, request.body);

    if (result.isErr() && result.error.type !== "request_validation") {
      request.log.error({ err: result.error }, "PATCH /todos failed");
    }

    const { status, body } = toSetAllTodosCompletedResponse(result);
    return reply.status(status).send(body);
  });

  app.delete("/todos", async (request, reply) => {
    const query = request.query as {
      status?: unknown;
      search?: unknown;
      page?: unknown;
      pageSize?: unknown;
    };
    const selectorResult = parseDeleteCompletedSelector(
      query.status,
      query.search,
      query.page,
      query.pageSize,
    );

    if (selectorResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: selectorResult.error.issues } });
    }

    const result = await deleteCompletedTodos(db);

    if (result.isErr()) {
      request.log.error({ err: result.error }, "DELETE /todos failed");
    }

    const { status, body } = toClearCompletedTodosResponse(result);
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
      const message =
        result.error.type === "validation"
          ? "GET /todos/:todoId: stored row failed validation"
          : "GET /todos/:todoId: database error";
      request.log.error({ err: result.error }, message);
    }

    const { status, body } = toGetTodoResponse(result);
    return reply.status(status).send(body);
  });

  app.put("/todos/:todoId", async (request, reply) => {
    const params = request.params as { todoId?: unknown };
    const idResult = parseTodoId(params.todoId);

    if (idResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: idResult.error.issues } });
    }

    const result = await replaceTodoService(db, idResult.value, request.body);

    if (
      result.isErr() &&
      result.error.type !== "request_validation" &&
      result.error.type !== "not_found"
    ) {
      request.log.error({ err: result.error }, "PUT /todos/:todoId failed");
    }

    const { status, body } = toReplaceTodoResponse(result);
    return reply.status(status).send(body);
  });

  app.patch("/todos/:todoId", async (request, reply) => {
    const params = request.params as { todoId?: unknown };
    const idResult = parseTodoId(params.todoId);

    if (idResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: idResult.error.issues } });
    }

    const result = await patchTodoService(db, idResult.value, request.body);

    if (
      result.isErr() &&
      result.error.type !== "request_validation" &&
      result.error.type !== "not_found"
    ) {
      request.log.error({ err: result.error }, "PATCH /todos/:todoId failed");
    }

    const { status, body } = toPatchTodoResponse(result);
    return reply.status(status).send(body);
  });

  app.delete("/todos/:todoId", async (request, reply) => {
    const params = request.params as { todoId?: unknown };
    const idResult = parseTodoId(params.todoId);

    if (idResult.isErr()) {
      return reply
        .status(400)
        .send({ error: { type: "validation", issues: idResult.error.issues } });
    }

    const result = await deleteTodoById(db, idResult.value);

    if (result.isErr() && result.error.type !== "not_found") {
      request.log.error({ err: result.error }, "DELETE /todos/:todoId failed");
    }

    const { status, body } = toDeleteTodoResponse(result);
    return reply.status(status).send(body);
  });
}
