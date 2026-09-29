import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todos } from "../db/schema.js";
import {
  createDisposableDatabase,
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "../db/test-db";
import { createTodo, getTodoById, listTodos } from "../module/todo.repository.js";

describe("todos repository", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("creates a todo and reads it back by id", async () => {
    const created = await createTodo(database.db, { title: "Write the migration proof" });
    if (created.isErr()) throw created.error;

    const found = await getTodoById(database.db, created.value.id);
    if (found.isErr()) throw found.error;

    expect(found.value).toEqual(created.value);
  });

  it("lists created todos", async () => {
    await createTodo(database.db, { title: "First listed todo" });
    await createTodo(database.db, { title: "Second listed todo" });

    const listed = await listTodos(database.db);
    if (listed.isErr()) throw listed.error;

    expect(listed.value.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a not-found error for a missing id", async () => {
    const result = await getTodoById(database.db, "00000000-0000-0000-0000-000000000000");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({
        type: "not_found",
        id: "00000000-0000-0000-0000-000000000000",
      });
    }
  });

  it("orders listed todos by createdAt ascending", async () => {
    const first = await createTodo(database.db, { title: "Created first" });
    const second = await createTodo(database.db, { title: "Created second" });
    if (first.isErr() || second.isErr()) {
      throw new Error("setup failed");
    }

    const listed = await listTodos(database.db);
    if (listed.isErr()) throw listed.error;

    const ids = listed.value.map((todo) => todo.id);
    expect(ids.indexOf(first.value.id)).toBeLessThan(ids.indexOf(second.value.id));
  });
});

describe("todos repository, createdAt ties", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("breaks a tied createdAt by ordering ids ascending", async () => {
    const sameCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const inserted = await database.db
      .insert(todos)
      .values([
        { title: "Tied todo A", createdAt: sameCreatedAt },
        { title: "Tied todo B", createdAt: sameCreatedAt },
        { title: "Tied todo C", createdAt: sameCreatedAt },
      ])
      .returning();

    const expectedIds = inserted.map((row) => row.id).sort();

    const listed = await listTodos(database.db);
    if (listed.isErr()) throw listed.error;

    expect(listed.value.map((todo) => todo.id)).toEqual(expectedIds);
  });
});

describe("todos repository, status filter", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("filters to only active (incomplete) todos", async () => {
    const active = await createTodo(database.db, { title: "Still active todo" });
    const completed = await createTodo(database.db, { title: "Finished todo" });
    if (active.isErr() || completed.isErr()) throw new Error("setup failed");
    await database.db
      .update(todos)
      .set({ completed: true })
      .where(eq(todos.id, completed.value.id));

    const listed = await listTodos(database.db, "active");
    if (listed.isErr()) throw listed.error;

    const ids = listed.value.map((todo) => todo.id);
    expect(ids).toContain(active.value.id);
    expect(ids).not.toContain(completed.value.id);
    expect(listed.value.every((todo) => todo.completed === false)).toBe(true);
  });

  it("filters to only completed todos", async () => {
    const active = await createTodo(database.db, { title: "Another active todo" });
    const completed = await createTodo(database.db, { title: "Another finished todo" });
    if (active.isErr() || completed.isErr()) throw new Error("setup failed");
    await database.db
      .update(todos)
      .set({ completed: true })
      .where(eq(todos.id, completed.value.id));

    const listed = await listTodos(database.db, "completed");
    if (listed.isErr()) throw listed.error;

    const ids = listed.value.map((todo) => todo.id);
    expect(ids).toContain(completed.value.id);
    expect(ids).not.toContain(active.value.id);
    expect(listed.value.every((todo) => todo.completed === true)).toBe(true);
  });

  it("returns every todo for the all filter, same as no filter", async () => {
    const unfiltered = await listTodos(database.db);
    const explicitAll = await listTodos(database.db, "all");
    if (unfiltered.isErr() || explicitAll.isErr()) throw new Error("setup failed");

    expect(explicitAll.value).toEqual(unfiltered.value);
  });
});

describe("todos repository, empty database", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns an empty list when no todos exist", async () => {
    const listed = await listTodos(database.db);
    if (listed.isErr()) throw listed.error;

    expect(listed.value).toEqual([]);
  });
});
