import {
  internalErrorResponseSchema,
  todoListResponseSchema,
  todoSchema,
  validationErrorResponseSchema,
  type Todo,
} from "@todo/contracts";
import { eq } from "drizzle-orm";
import { err, ok } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todos } from "../db/schema.js";
import {
  createDisposableDatabase,
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "../db/test-db";
import { buildApp } from "./app.js";
import { createTodo } from "./todo.repository.js";
import {
  parseSearchQuery,
  parseStatusFilter,
  toCreateTodoResponse,
  toListTodosResponse,
} from "./todo.routes.js";

const exampleTodo: Todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Example todo",
  completed: false,
  createdAt: new Date().toISOString(),
};

describe("toCreateTodoResponse", () => {
  it("maps a successful create to 201 with the created todo", () => {
    const todo = {
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      title: "Write the milestone plan",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const response = toCreateTodoResponse(ok(todo));

    expect(response.status).toBe(201);
    expect(todoSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a request-body validation error to 400", () => {
    const response = toCreateTodoResponse(
      err({
        type: "request_validation",
        issues: ["Too small: expected string to have >=6 characters"],
      }),
    );

    expect(response.status).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a database error to 500 without leaking the cause", () => {
    const response = toCreateTodoResponse(
      err({ type: "database", cause: new Error("connection refused") }),
    );

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("connection refused");
  });

  it("maps a stored-row validation error to 500, not 400", () => {
    const response = toCreateTodoResponse(
      err({ type: "validation", issues: ["stored row failed todoSchema"] }),
    );

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

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

describe("parseStatusFilter", () => {
  it("defaults to all when status is omitted", () => {
    const result = parseStatusFilter(undefined);

    expect(result).toEqual(ok("all"));
  });

  it.each(["all", "active", "completed"])("accepts %s", (value) => {
    const result = parseStatusFilter(value);

    expect(result).toEqual(ok(value));
  });

  it("rejects an unknown status", () => {
    const result = parseStatusFilter("bogus");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("request_validation");
    }
  });

  it("rejects a duplicate query param, which Fastify parses as an array", () => {
    const result = parseStatusFilter(["active", "completed"]);

    expect(result.isErr()).toBe(true);
  });
});

describe("parseSearchQuery", () => {
  it("returns undefined when search is omitted", () => {
    const result = parseSearchQuery(undefined);

    expect(result).toEqual(ok(undefined));
  });

  it("treats a blank string as undefined", () => {
    const result = parseSearchQuery("");

    expect(result).toEqual(ok(undefined));
  });

  it("treats a whitespace-only string as undefined", () => {
    const result = parseSearchQuery("   ");

    expect(result).toEqual(ok(undefined));
  });

  it("trims a search term with leading and trailing whitespace", () => {
    const result = parseSearchQuery("  milestone  ");

    expect(result).toEqual(ok("milestone"));
  });

  it("rejects a term over the length limit", () => {
    const result = parseSearchQuery("a".repeat(101));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("request_validation");
    }
  });

  it("accepts a term at the length limit", () => {
    const result = parseSearchQuery("a".repeat(100));

    expect(result).toEqual(ok("a".repeat(100)));
  });

  it("rejects a duplicate query param, which Fastify parses as an array", () => {
    const result = parseSearchQuery(["active", "completed"]);

    expect(result.isErr()).toBe(true);
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

describe("GET /todos?status=", () => {
  let database: DisposableDatabase;
  let activeId: string;
  let completedId: string;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);

    const active = await createTodo(database.db, { title: "Active filter todo" });
    const completed = await createTodo(database.db, { title: "Completed filter todo" });
    if (active.isErr() || completed.isErr()) throw new Error("setup failed");

    activeId = active.value.id;
    completedId = completed.value.id;
    await database.db.update(todos).set({ completed: true }).where(eq(todos.id, completedId));
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns every todo when status is omitted", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).toEqual(expect.arrayContaining([activeId, completedId]));
  });

  it("returns every todo for status=all", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?status=all" });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).toEqual(expect.arrayContaining([activeId, completedId]));
  });

  it("returns only active todos for status=active", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?status=active" });

    expect(response.statusCode).toBe(200);
    const items = response.json().items as Todo[];
    expect(items.map((todo) => todo.id)).toContain(activeId);
    expect(items.map((todo) => todo.id)).not.toContain(completedId);
    expect(items.every((todo) => todo.completed === false)).toBe(true);
  });

  it("returns only completed todos for status=completed", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?status=completed" });

    expect(response.statusCode).toBe(200);
    const items = response.json().items as Todo[];
    expect(items.map((todo) => todo.id)).toContain(completedId);
    expect(items.map((todo) => todo.id)).not.toContain(activeId);
    expect(items.every((todo) => todo.completed === true)).toBe(true);
  });

  it("returns 400 for an unknown status value", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?status=bogus" });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a duplicate status query param", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "GET",
      url: "/todos?status=active&status=completed",
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});

describe("GET /todos?search=", () => {
  let database: DisposableDatabase;
  let matchingId: string;
  let nonMatchingId: string;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);

    const matching = await createTodo(database.db, { title: "Write the milestone plan" });
    const nonMatching = await createTodo(database.db, { title: "Buy groceries" });
    if (matching.isErr() || nonMatching.isErr()) throw new Error("setup failed");

    matchingId = matching.value.id;
    nonMatchingId = nonMatching.value.id;
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns only todos whose title matches the search term", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?search=milestone" });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).toContain(matchingId);
    expect(ids).not.toContain(nonMatchingId);
  });

  it("matches case-insensitively", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?search=MILESTONE" });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).toContain(matchingId);
  });

  it("returns the full unfiltered list when search is blank, same as omitted", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?search=" });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).toEqual(expect.arrayContaining([matchingId, nonMatchingId]));
  });

  it("returns 400 for a search term over the length limit", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "GET",
      url: `/todos?search=${"a".repeat(101)}`,
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a duplicate search query param", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "GET",
      url: "/todos?search=a&search=b",
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("combines status and search with AND", async () => {
    const app = buildApp(database.db);
    await database.db.update(todos).set({ completed: true }).where(eq(todos.id, matchingId));

    const response = await app.inject({
      method: "GET",
      url: "/todos?status=active&search=milestone",
    });

    expect(response.statusCode).toBe(200);
    const ids = response.json().items.map((todo: Todo) => todo.id);
    expect(ids).not.toContain(matchingId);
  });
});
