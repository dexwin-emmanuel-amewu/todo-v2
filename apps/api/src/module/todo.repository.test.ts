import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
});
