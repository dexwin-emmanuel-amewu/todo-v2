import {
  type InternalErrorResponse,
  type Todo,
  type TodoListResponse,
  todoListResponseSchema,
} from "@todo/contracts";
import type { FastifyInstance } from "fastify";
import type { Result } from "neverthrow";

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
  | { status: 200; body: TodoListResponse }
  | { status: 500; body: InternalErrorResponse };

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

export function registerTodoRoutes(app: FastifyInstance, db: Db): void {
  app.post("/todos", async (request, reply) => {
    const result = await createTodoFlow(db, request.body);

    if (result.isErr() && result.error.type !== "request_validation") {
      request.log.error({ err: result.error }, "POST /todos failed");
    }

    const { status, body } = toCreateTodoResponse(result);
    return reply.code(status).send(body);
  });

  app.get("/todos", async (_request, reply) => {
    const result = await listTodos(db);
    const { status, body } = toListTodosResponse(result);

    reply.status(status).send(body);
  });
}
