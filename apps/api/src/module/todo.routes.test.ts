import {
  internalErrorResponseSchema,
  notFoundErrorResponseSchema,
  setAllTodosCompletedResponseSchema,
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
import { createTodo, getTodoById } from "./todo.repository.js";
import {
  patchTodoService,
  replaceTodoService,
  setAllTodosCompletedService,
} from "./todo.service.js";
import {
  parsePagination,
  parseSearchQuery,
  parseStatusFilter,
  parseTodoId,
  toCreateTodoResponse,
  toDeleteTodoResponse,
  toGetTodoResponse,
  toListTodosResponse,
  toPatchTodoResponse,
  toReplaceTodoResponse,
  toSetAllTodosCompletedResponse,
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
  it("maps an empty page to 200 with pagination metadata", () => {
    const body = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
    const response = toListTodosResponse(ok(body));

    expect(response).toEqual({ status: 200, body });
    expect(todoListResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a non-empty page to 200 with those items and metadata", () => {
    const body = { items: [exampleTodo], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    const response = toListTodosResponse(ok(body));

    expect(response).toEqual({ status: 200, body });
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

describe("parsePagination", () => {
  it("defaults to page 1 and pageSize 20 when both are omitted", () => {
    const result = parsePagination(undefined, undefined);

    expect(result).toEqual(ok({ page: 1, pageSize: 20 }));
  });

  it("accepts explicit page and pageSize values", () => {
    const result = parsePagination("2", "5");

    expect(result).toEqual(ok({ page: 2, pageSize: 5 }));
  });

  it.each(["0", "-1", "1.5", "abc"])("rejects an invalid page value %s", (value) => {
    const result = parsePagination(value, undefined);

    expect(result.isErr()).toBe(true);
  });

  it.each(["0", "-1", "1.5", "abc", "101"])("rejects an invalid pageSize value %s", (value) => {
    const result = parsePagination(undefined, value);

    expect(result.isErr()).toBe(true);
  });

  it("accepts a pageSize at the cap", () => {
    const result = parsePagination(undefined, "100");

    expect(result).toEqual(ok({ page: 1, pageSize: 100 }));
  });

  it("rejects a duplicate page query param, which Fastify parses as an array", () => {
    const result = parsePagination(["1", "2"], undefined);

    expect(result.isErr()).toBe(true);
  });

  it("rejects a duplicate pageSize query param, which Fastify parses as an array", () => {
    const result = parsePagination(undefined, ["10", "20"]);

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

  it("returns 200 and an empty items array with default pagination when no todos exist", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
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

describe("GET /todos?page=&pageSize=", () => {
  let database: DisposableDatabase;
  let ids: string[];

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);

    ids = [];
    for (let index = 0; index < 5; index += 1) {
      const created = await createTodo(database.db, { title: `Paginated todo ${index}` });
      if (created.isErr()) throw new Error("setup failed");
      ids.push(created.value.id);
    }
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("uses defaults of page 1 and pageSize 20 when omitted", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.totalItems).toBe(5);
    expect(body.totalPages).toBe(1);
    expect(body.items.map((todo: Todo) => todo.id)).toEqual(ids);
  });

  it("returns the requested page and pageSize slice", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?page=2&pageSize=2" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(2);
    expect(body.totalItems).toBe(5);
    expect(body.totalPages).toBe(3);
    expect(body.items.map((todo: Todo) => todo.id)).toEqual(ids.slice(2, 4));
  });

  it("returns an empty items array for a page beyond the last page", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?page=999" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalItems).toBe(5);
    expect(body.totalPages).toBe(1);
  });

  it.each(["0", "-1", "1.5", "abc"])("returns 400 for an invalid page value %s", async (value) => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: `/todos?page=${value}` });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a pageSize over the cap", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?pageSize=101" });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a duplicate page query param", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?page=1&page=2" });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a duplicate pageSize query param", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos?pageSize=5&pageSize=10" });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("combines status, search, and pagination together", async () => {
    const app = buildApp(database.db);
    await database.db.update(todos).set({ completed: true }).where(eq(todos.id, ids[0]!));

    const response = await app.inject({
      method: "GET",
      url: "/todos?status=active&search=paginated&page=1&pageSize=2",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.totalItems).toBe(4);
    expect(body.items.map((todo: Todo) => todo.id)).toEqual(ids.slice(1, 3));
  });
});

describe("toSetAllTodosCompletedResponse", () => {
  it("maps a successful update to 200 with the updated count", () => {
    const response = toSetAllTodosCompletedResponse(ok({ updatedCount: 3 }));

    expect(response.status).toBe(200);
    expect(setAllTodosCompletedResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toEqual({ updatedCount: 3 });
  });

  it("maps a request-body validation error to 400", () => {
    const response = toSetAllTodosCompletedResponse(
      err({ type: "request_validation", issues: ["Required"] }),
    );

    expect(response.status).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a database error to 500", () => {
    const response = toSetAllTodosCompletedResponse(
      err({ type: "database", cause: new Error("boom") }),
    );

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("setAllTodosCompletedService", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("calls through to the repository and resolves ok", async () => {
    const created = await createTodo(database.db, { title: "Mark me complete" });
    if (created.isErr()) throw created.error;

    const result = await setAllTodosCompletedService(database.db, { completed: true });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.updatedCount).toBeGreaterThanOrEqual(1);
    }

    const after = await getTodoById(database.db, created.value.id);
    if (after.isErr()) throw after.error;
    expect(after.value.completed).toBe(true);
  });

  it("never reaches the repository for an empty body", async () => {
    const created = await createTodo(database.db, { title: "Should stay unchanged" });
    if (created.isErr()) throw created.error;

    const result = await setAllTodosCompletedService(database.db, {});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("request_validation");
    }

    const unchanged = await getTodoById(database.db, created.value.id);
    if (unchanged.isErr()) throw unchanged.error;
    expect(unchanged.value.completed).toBe(created.value.completed);
  });
});

describe("PATCH /todos", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("marks every active todo completed and returns the count actually changed", async () => {
    const app = buildApp(database.db);
    const first = await createTodo(database.db, { title: "First active todo" });
    const second = await createTodo(database.db, { title: "Second active todo" });
    if (first.isErr() || second.isErr()) throw new Error("setup failed");

    const response = await app.inject({
      method: "PATCH",
      url: "/todos",
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updatedCount: 2 });

    const active = await app.inject({ method: "GET", url: "/todos?status=active" });
    const completed = await app.inject({ method: "GET", url: "/todos?status=completed" });
    expect(active.json().totalItems).toBe(0);
    expect(completed.json().totalItems).toBe(2);
  });

  it("returns updatedCount: 0 on an immediate repeat call with the same value", async () => {
    const app = buildApp(database.db);

    const response = await app.inject({
      method: "PATCH",
      url: "/todos",
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updatedCount: 0 });
  });

  it("marks every todo active, only flipping the ones that were completed", async () => {
    const app = buildApp(database.db);
    const third = await createTodo(database.db, { title: "Third, still active todo" });
    if (third.isErr()) throw third.error;

    const response = await app.inject({
      method: "PATCH",
      url: "/todos",
      payload: { completed: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updatedCount: 2 });

    const active = await app.inject({ method: "GET", url: "/todos?status=active" });
    expect(active.json().totalItems).toBe(3);
  });

  it("returns 400 for an empty body, and touches nothing", async () => {
    const app = buildApp(database.db);
    const before = await app.inject({ method: "GET", url: "/todos" });

    const response = await app.inject({ method: "PATCH", url: "/todos", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);

    const after = await app.inject({ method: "GET", url: "/todos" });
    expect(after.json().totalItems).toBe(before.json().totalItems);
  });

  it("returns 400 when completed is not a boolean", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: "/todos",
      payload: { completed: "true" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});

describe("PATCH /todos, empty collection", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 200 with updatedCount: 0 when there are no todos", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: "/todos",
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updatedCount: 0 });
  });
});

describe("parseTodoId", () => {
  it("accepts a well-formed uuid and returns it unchanged", () => {
    const result = parseTodoId("5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a");

    expect(result).toEqual(ok("5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a"));
  });

  it.each(["abc", "123", ""])("rejects the malformed id %s", (value) => {
    expect(parseTodoId(value).isErr()).toBe(true);
  });

  it("rejects a missing param", () => {
    expect(parseTodoId(undefined).isErr()).toBe(true);
  });

  it("rejects a non-string value", () => {
    expect(parseTodoId(["id-a", "id-b"]).isErr()).toBe(true);
  });
});

describe("toGetTodoResponse", () => {
  it("maps a found todo to 200 with the bare todo", () => {
    const response = toGetTodoResponse(ok(exampleTodo));

    expect(response.status).toBe(200);
    expect(todoSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toEqual(exampleTodo);
  });

  it("maps a not-found error to 404", () => {
    const response = toGetTodoResponse(err({ type: "not_found", id: exampleTodo.id }));

    expect(response.status).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("does not echo the requested id back in the 404 body", () => {
    const response = toGetTodoResponse(err({ type: "not_found", id: exampleTodo.id }));

    expect(JSON.stringify(response.body)).not.toContain(exampleTodo.id);
  });

  it("maps a database error to 500", () => {
    const response = toGetTodoResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a stored-row validation error to 500, not 404", () => {
    const response = toGetTodoResponse(err({ type: "validation", issues: ["bad row"] }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("toReplaceTodoResponse", () => {
  it("maps a successful replace to 200 with the updated todo", () => {
    const response = toReplaceTodoResponse(ok(exampleTodo));

    expect(response.status).toBe(200);
    expect(todoSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a request-body validation error to 400", () => {
    const response = toReplaceTodoResponse(
      err({ type: "request_validation", issues: ["Missing completed"] }),
    );

    expect(response.status).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a not-found error to 404 without echoing the id", () => {
    const response = toReplaceTodoResponse(err({ type: "not_found", id: exampleTodo.id }));

    expect(response.status).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.body).success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(exampleTodo.id);
  });

  it("maps a database error to 500", () => {
    const response = toReplaceTodoResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a stored-row validation error to 500, not 200 and not 404", () => {
    const response = toReplaceTodoResponse(err({ type: "validation", issues: ["bad row"] }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("replaceTodoService", () => {
describe("replaceTodoService", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("calls through to the repository and resolves ok with the updated todo", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const result = await replaceTodoService(database.db, created.value.id, {
      title: "Updated title",
      completed: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe("Updated title");
      expect(result.value.completed).toBe(true);
    }
  });

  it("never reaches the repository for an invalid body", async () => {
    const created = await createTodo(database.db, { title: "Should stay unchanged" });
    if (created.isErr()) throw created.error;

    const result = await replaceTodoService(database.db, created.value.id, { title: "New title" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("request_validation");
    }

    const unchanged = await getTodoById(database.db, created.value.id);
    if (unchanged.isErr()) throw unchanged.error;
    expect(unchanged.value).toEqual(created.value);
  });
});

describe("toPatchTodoResponse", () => {
  it("maps a successful patch to 200 with the updated todo", () => {
    const response = toPatchTodoResponse(ok(exampleTodo));

    expect(response.status).toBe(200);
    expect(todoSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a request-body validation error to 400", () => {
    const response = toPatchTodoResponse(
      err({ type: "request_validation", issues: ["At least one field must be provided"] }),
    );

    expect(response.status).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a not-found error to 404 without echoing the id", () => {
    const response = toPatchTodoResponse(err({ type: "not_found", id: exampleTodo.id }));

    expect(response.status).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.body).success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(exampleTodo.id);
  });

  it("maps a database error to 500", () => {
    const response = toPatchTodoResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a stored-row validation error to 500, not 200 and not 404", () => {
    const response = toPatchTodoResponse(err({ type: "validation", issues: ["bad row"] }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("patchTodoService", () => {
describe("patchTodoService", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("calls through to the repository and resolves ok with the updated todo, completed unchanged", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const result = await patchTodoService(database.db, created.value.id, { title: "New title" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe("New title");
      expect(result.value.completed).toBe(created.value.completed);
    }
  });

  it("never reaches the repository for an empty body", async () => {
    const created = await createTodo(database.db, { title: "Should stay unchanged" });
    if (created.isErr()) throw created.error;

    const result = await patchTodoService(database.db, created.value.id, {});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("request_validation");
    }

    const unchanged = await getTodoById(database.db, created.value.id);
    if (unchanged.isErr()) throw unchanged.error;
    expect(unchanged.value).toEqual(created.value);
  });
});

describe("GET /todos/:todoId", () => {
  let database: DisposableDatabase;
  let firstId: string;
  let secondId: string;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);

    const first = await createTodo(database.db, { title: "First fetched by id" });
    const second = await createTodo(database.db, { title: "Second fetched by id" });
    if (first.isErr() || second.isErr()) throw new Error("setup failed");

    firstId = first.value.id;
    secondId = second.value.id;
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 200 and the todo for an existing id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: `/todos/${firstId}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(todoSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      id: firstId,
      title: "First fetched by id",
      completed: false,
      createdAt: expect.any(String),
    });
  });

  it("returns the requested todo, not simply the first row", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: `/todos/${secondId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(secondId);
  });

  it("returns 404 not_found for a well-formed but unused id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "GET",
      url: "/todos/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { type: "not_found" } });
    expect(notFoundErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("does not leak the requested id in the 404 body", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "GET",
      url: "/todos/00000000-0000-0000-0000-000000000000",
    });

    expect(response.body).not.toContain("00000000-0000-0000-0000-000000000000");
  });

  it.each(["abc", "123", "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1"])(
    "returns 400 for the malformed id %s",
    async (value) => {
      const app = buildApp(database.db);
      const response = await app.inject({ method: "GET", url: `/todos/${value}` });

      expect(response.statusCode).toBe(400);
      expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
    },
  );

  it("still serves the collection route", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/todos" });

    expect(response.statusCode).toBe(200);
    expect(todoListResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});

describe("PUT /todos/:todoId", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 200 with the updated todo for a valid body", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PUT",
      url: `/todos/${created.value.id}`,
      payload: { title: "Updated title", completed: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(todoSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      id: created.value.id,
      title: "Updated title",
      completed: true,
      createdAt: created.value.createdAt,
    });
  });

  it("persists the change, visible on a later GET", async () => {
    const created = await createTodo(database.db, { title: "Before the update" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    await app.inject({
      method: "PUT",
      url: `/todos/${created.value.id}`,
      payload: { title: "After the update", completed: true },
    });

    const response = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ title: "After the update", completed: true });
  });

  it("returns 404 for a well-formed but unused id, and creates no row", async () => {
    const app = buildApp(database.db);
    const before = await app.inject({ method: "GET", url: "/todos" });

    const response = await app.inject({
      method: "PUT",
      url: "/todos/00000000-0000-0000-0000-000000000000",
      payload: { title: "Should not be created", completed: false },
    });

    expect(response.statusCode).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.json()).success).toBe(true);

    const after = await app.inject({ method: "GET", url: "/todos" });
    expect(after.json().totalItems).toBe(before.json().totalItems);
  });

  it("returns 400 for a malformed id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PUT",
      url: "/todos/abc",
      payload: { title: "Valid title here", completed: false },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for an invalid body: title too short, completed missing", async () => {
    const created = await createTodo(database.db, { title: "Has a valid body originally" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PUT",
      url: `/todos/${created.value.id}`,
      payload: { title: "hi" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns the id's 400 when both the id and the body are invalid", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PUT",
      url: "/todos/abc",
      payload: { title: "hi" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});

describe("PATCH /todos/:todoId", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 200 with completed-only body, leaving title unchanged", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(todoSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      id: created.value.id,
      title: "Original title",
      completed: true,
      createdAt: created.value.createdAt,
    });
  });

  it("returns 200 with title-only body, leaving completed unchanged", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { title: "New title" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(todoSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      id: created.value.id,
      title: "New title",
      completed: created.value.completed,
      createdAt: created.value.createdAt,
    });
  });

  it("returns 200 and updates both fields when both are supplied", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { title: "New title", completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: created.value.id,
      title: "New title",
      completed: true,
      createdAt: created.value.createdAt,
    });
  });

  it("persists the change, visible on a later GET", async () => {
    const created = await createTodo(database.db, { title: "Before the patch" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { title: "After the patch" },
    });

    const response = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ title: "After the patch" });
  });

  it("returns 400 for an empty body, and touches nothing", async () => {
    const created = await createTodo(database.db, { title: "Should stay unchanged" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);

    const after = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });
    expect(after.json()).toEqual(created.value);
  });

  it("returns the same 400 as an empty body when the body has only unrecognized fields", async () => {
    const created = await createTodo(database.db, { title: "Should also stay unchanged" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { notes: "x" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 404 for a well-formed but unused id, and creates no row", async () => {
    const app = buildApp(database.db);
    const before = await app.inject({ method: "GET", url: "/todos" });

    const response = await app.inject({
      method: "PATCH",
      url: "/todos/00000000-0000-0000-0000-000000000000",
      payload: { title: "Should not be created" },
    });

    expect(response.statusCode).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.json()).success).toBe(true);

    const after = await app.inject({ method: "GET", url: "/todos" });
    expect(after.json().totalItems).toBe(before.json().totalItems);
  });

  it("returns 400 for a malformed id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: "/todos/abc",
      payload: { title: "Valid title here" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for an invalid title: too short", async () => {
    const created = await createTodo(database.db, { title: "Has a valid body originally" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { title: "hi" },
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns the id's 400 when both the id and the body are invalid", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "PATCH",
      url: "/todos/abc",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});

describe("PATCH /todos/:todoId vs PUT /todos/:todoId", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("accepts a title-only body on PATCH (200) but rejects it on PUT (400) for the same todo", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const body = { title: "New title" };

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: body,
    });
    expect(patchResponse.statusCode).toBe(200);

    const putResponse = await app.inject({
      method: "PUT",
      url: `/todos/${created.value.id}`,
      payload: body,
    });
    expect(putResponse.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(putResponse.json()).success).toBe(true);
  });

  it("PATCH preserves the untouched field; PUT with the same partial body is rejected and leaves the row untouched too", async () => {
    const created = await createTodo(database.db, { title: "Keep this title" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/todos/${created.value.id}`,
      payload: { completed: true },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().title).toBe("Keep this title");

    const putResponse = await app.inject({
      method: "PUT",
      url: `/todos/${created.value.id}`,
      payload: { completed: false },
    });
    expect(putResponse.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(putResponse.json()).success).toBe(true);

    const after = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });
    expect(after.json()).toEqual({
      id: created.value.id,
      title: "Keep this title",
      completed: true,
      createdAt: created.value.createdAt,
    });
  });
});

describe("toDeleteTodoResponse", () => {
  it("maps a successful delete to 204 with an empty body", () => {
    const response = toDeleteTodoResponse(ok(undefined));

    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
  });

  it("maps a not-found error to 404 without echoing the id", () => {
    const response = toDeleteTodoResponse(err({ type: "not_found", id: exampleTodo.id }));

    expect(response.status).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.body).success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(exampleTodo.id);
  });

  it("maps a database error to 500", () => {
    const response = toDeleteTodoResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe("DELETE /todos/:todoId", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns 204 with an empty body for an existing todo", async () => {
    const created = await createTodo(database.db, { title: "Todo to delete" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const response = await app.inject({ method: "DELETE", url: `/todos/${created.value.id}` });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
  });

  it("removes the todo: a later GET for the same id returns 404", async () => {
    const created = await createTodo(database.db, { title: "Gone after delete" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    await app.inject({ method: "DELETE", url: `/todos/${created.value.id}` });

    const response = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });

    expect(response.statusCode).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("removes the todo from the collection and updates totalItems", async () => {
    const created = await createTodo(database.db, { title: "Removed from the list" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const before = await app.inject({ method: "GET", url: "/todos" });

    await app.inject({ method: "DELETE", url: `/todos/${created.value.id}` });

    const after = await app.inject({ method: "GET", url: "/todos" });
    expect(after.json().totalItems).toBe(before.json().totalItems - 1);
    expect(after.json().items.map((todo: Todo) => todo.id)).not.toContain(created.value.id);
  });

  it("returns 404 for a well-formed but unused id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({
      method: "DELETE",
      url: "/todos/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 400 for a malformed id", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "DELETE", url: "/todos/abc" });

    expect(response.statusCode).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("returns 404 on a second delete of the same id, the final state is deleted", async () => {
    const created = await createTodo(database.db, { title: "Delete me twice over HTTP" });
    if (created.isErr()) throw created.error;

    const app = buildApp(database.db);
    const first = await app.inject({ method: "DELETE", url: `/todos/${created.value.id}` });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({ method: "DELETE", url: `/todos/${created.value.id}` });
    expect(second.statusCode).toBe(404);
    expect(notFoundErrorResponseSchema.safeParse(second.json()).success).toBe(true);

    const finalGet = await app.inject({ method: "GET", url: `/todos/${created.value.id}` });
    expect(finalGet.statusCode).toBe(404);
  });

  it("deletes only the targeted todo, leaving another todo retrievable and unchanged", async () => {
    const target = await createTodo(database.db, { title: "Target todo" });
    const other = await createTodo(database.db, { title: "Untouched todo" });
    if (target.isErr() || other.isErr()) throw new Error("setup failed");

    const app = buildApp(database.db);
    await app.inject({ method: "DELETE", url: `/todos/${target.value.id}` });

    const response = await app.inject({ method: "GET", url: `/todos/${other.value.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: other.value.id,
      title: "Untouched todo",
      completed: false,
      createdAt: other.value.createdAt,
    });
  });
});
