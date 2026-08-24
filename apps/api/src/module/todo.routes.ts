import {
  type InternalErrorResponse,
  type Todo,
  type TodoListResponse,
  todoListResponseSchema,
} from "@todo/contracts";
import type { FastifyInstance } from "fastify";
import type { Result } from "neverthrow";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { DatabaseError, ValidationError } from "../db/errors.js";
import type * as schema from "../db/schema.js";
import { listTodos } from "./todo.repository.js";

type Db = NodePgDatabase<typeof schema>;

const internalErrorBody: InternalErrorResponse = { error: { type: "internal" } };

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

export function registerTodoRoutes(app: FastifyInstance, db: Db): void {
  app.get("/todos", async (_request, reply) => {
    const result = await listTodos(db);
    const { status, body } = toListTodosResponse(result);

    reply.status(status).send(body);
  });
}