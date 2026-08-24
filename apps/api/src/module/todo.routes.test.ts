import { todoListResponseSchema, internalErrorResponseSchema, type Todo } from "@todo/contracts";
import { err, ok } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDisposableDatabase,
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "../db/test-db";
import { buildApp } from "./app.js";
import { createTodo } from "./todo.repository.js";
import { toListTodosResponse } from "./todo.routes.js";

const exampleTodo: Todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Example todo",
  completed: false,
  createdAt: new Date().toISOString(),
};

describe("toListTodosResponse", () => {
  it("maps an empty list to 200 with an empty items array", () => {
    const response = toListTodosResponse(ok([]));

    expect(response).toEqual({ status: 200, body: { items: [] } });
    expect(todoListResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a non-empty list to 200 with those items", () => {
    const response = toListTodosResponse(ok([exampleTodo]));

    expect(response).toEqual({ status: 200, body: { items: [exampleTodo] } });
    expect(todoListResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a database error to 500 with an internal error body", () => {
    const response = toListTodosResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response).toEqual({ status: 500, body: { error: { type: "internal" } } });
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a validation error to 500 with an internal error body", () => {
    const response = toListTodosResponse(err({ type: "validation", issues: ["bad row"] }));

    expect(response).toEqual({ status: 500, body: { error: { type: "internal" } } });
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("GET /todos", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 200 and an empty items array when no todos exist", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it("returns 200 with created todos, ordered by createdAt ascending", async () => {
    const first = await createTodo(database.db, { title: "First listed todo" });
    const second = await createTodo(database.db, { title: "Second listed todo" });
    if (first.isErr() || second.isErr()) throw new Error("setup failed");

    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(todoListResponseSchema.safeParse(body).success).toBe(true);

    const ids: string[] = body.items.map((todo: Todo) => todo.id);
    expect(ids.indexOf(first.value.id)).toBeLessThan(ids.indexOf(second.value.id));
  });
});
