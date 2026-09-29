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
