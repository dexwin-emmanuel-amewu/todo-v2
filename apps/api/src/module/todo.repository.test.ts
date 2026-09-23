import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todos } from "../db/schema.js";
import {
  createDisposableDatabase,
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "../db/test-db";
import {
  createTodo,
  deleteTodoById,
  getTodoById,
  listTodos,
  patchTodoById,
  replaceTodoById,
  setAllTodosCompleted,
} from "../module/todo.repository.js";

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

    expect(listed.value.items.length).toBeGreaterThanOrEqual(2);
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

    const ids = listed.value.items.map((todo) => todo.id);
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

    expect(listed.value.items.map((todo) => todo.id)).toEqual(expectedIds);
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

    const ids = listed.value.items.map((todo) => todo.id);
    expect(ids).toContain(active.value.id);
    expect(ids).not.toContain(completed.value.id);
    expect(listed.value.items.every((todo) => todo.completed === false)).toBe(true);
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

    const ids = listed.value.items.map((todo) => todo.id);
    expect(ids).toContain(completed.value.id);
    expect(ids).not.toContain(active.value.id);
    expect(listed.value.items.every((todo) => todo.completed === true)).toBe(true);
  });

  it("returns every todo for the all filter, same as no filter", async () => {
    const unfiltered = await listTodos(database.db);
    const explicitAll = await listTodos(database.db, "all");
    if (unfiltered.isErr() || explicitAll.isErr()) throw new Error("setup failed");

    expect(explicitAll.value).toEqual(unfiltered.value);
  });
});

describe("todos repository, search", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("matches a case-insensitive substring of the title, not just a prefix", async () => {
    const created = await createTodo(database.db, { title: "Write the milestone plan" });
    if (created.isErr()) throw created.error;

    const listed = await listTodos(database.db, "all", "mile");
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items.map((todo) => todo.id)).toContain(created.value.id);
  });

  it("matches regardless of case", async () => {
    const created = await createTodo(database.db, { title: "Write the milestone plan" });
    if (created.isErr()) throw created.error;

    const listed = await listTodos(database.db, "all", "MILE");
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items.map((todo) => todo.id)).toContain(created.value.id);
  });

  it("returns an empty array when nothing matches", async () => {
    const listed = await listTodos(database.db, "all", "zzz-no-match-anywhere");
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items).toEqual([]);
    expect(listed.value.totalItems).toBe(0);
  });

  it("behaves exactly like no search when search is undefined", async () => {
    const unfiltered = await listTodos(database.db, "all");
    const explicitUndefined = await listTodos(database.db, "all", undefined);
    if (unfiltered.isErr() || explicitUndefined.isErr()) throw new Error("setup failed");

    expect(explicitUndefined.value).toEqual(unfiltered.value);
  });

  it("treats literal percent and underscore characters as literal, not as wildcards", async () => {
    const literal = await createTodo(database.db, { title: "100% done_deal today" });
    const unrelated = await createTodo(database.db, { title: "Something else entirely" });
    if (literal.isErr() || unrelated.isErr()) throw new Error("setup failed");

    const listed = await listTodos(database.db, "all", "100% done_deal");
    if (listed.isErr()) throw listed.error;

    const ids = listed.value.items.map((todo) => todo.id);
    expect(ids).toContain(literal.value.id);
    expect(ids).not.toContain(unrelated.value.id);
  });

  it("combines status and search with AND", async () => {
    const activeMatch = await createTodo(database.db, { title: "Ship the search feature" });
    const completedMatch = await createTodo(database.db, { title: "Ship the search docs" });
    if (activeMatch.isErr() || completedMatch.isErr()) throw new Error("setup failed");
    await database.db
      .update(todos)
      .set({ completed: true })
      .where(eq(todos.id, completedMatch.value.id));

    const listed = await listTodos(database.db, "active", "ship the search");
    if (listed.isErr()) throw listed.error;

    const ids = listed.value.items.map((todo) => todo.id);
    expect(ids).toContain(activeMatch.value.id);
    expect(ids).not.toContain(completedMatch.value.id);
  });
});

describe("todos repository, pagination", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns the first page in sort order, with correct totals", async () => {
    for (let index = 0; index < 5; index += 1) {
      await createTodo(database.db, { title: `Pagination todo ${index}` });
    }

    const listed = await listTodos(database.db, "all", undefined, { page: 1, pageSize: 2 });
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items.length).toBe(2);
    expect(listed.value.page).toBe(1);
    expect(listed.value.pageSize).toBe(2);
    expect(listed.value.totalItems).toBe(5);
    expect(listed.value.totalPages).toBe(3);
  });

  it("returns the requested middle page", async () => {
    const all = await listTodos(database.db, "all", undefined, { page: 1, pageSize: 100 });
    if (all.isErr()) throw all.error;
    const expectedIds = all.value.items.slice(2, 4).map((todo) => todo.id);

    const listed = await listTodos(database.db, "all", undefined, { page: 2, pageSize: 2 });
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items.map((todo) => todo.id)).toEqual(expectedIds);
    expect(listed.value.page).toBe(2);
  });

  it("returns a partial last page", async () => {
    const listed = await listTodos(database.db, "all", undefined, { page: 3, pageSize: 2 });
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items.length).toBe(1);
    expect(listed.value.totalPages).toBe(3);
  });

  it("returns an empty items array for a page beyond the last page, with accurate totals", async () => {
    const listed = await listTodos(database.db, "all", undefined, { page: 4, pageSize: 2 });
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items).toEqual([]);
    expect(listed.value.totalItems).toBe(5);
    expect(listed.value.totalPages).toBe(3);
  });

  it("paginates only over the status-filtered set", async () => {
    await database.db.update(todos).set({ completed: true });
    const active = await createTodo(database.db, { title: "Only active pagination todo" });
    if (active.isErr()) throw new Error("setup failed");

    const listed = await listTodos(database.db, "active", undefined, { page: 1, pageSize: 20 });
    if (listed.isErr()) throw listed.error;

    expect(listed.value.totalItems).toBe(1);
    expect(listed.value.items.map((todo) => todo.id)).toEqual([active.value.id]);
  });
});

describe("todos repository, empty pagination", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("returns totalPages 0 for an empty table", async () => {
    const listed = await listTodos(database.db);
    if (listed.isErr()) throw listed.error;

    expect(listed.value.items).toEqual([]);
    expect(listed.value.totalItems).toBe(0);
    expect(listed.value.totalPages).toBe(0);
  });
});

describe("todos repository, replaceTodoById", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("updates title and completed and returns the updated row", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const replaced = await replaceTodoById(database.db, created.value.id, {
      title: "Replaced title",
      completed: true,
    });
    if (replaced.isErr()) throw replaced.error;

    expect(replaced.value.title).toBe("Replaced title");
    expect(replaced.value.completed).toBe(true);
  });

  it("leaves id and createdAt unchanged", async () => {
    const created = await createTodo(database.db, { title: "Keep my id and createdAt" });
    if (created.isErr()) throw created.error;

    const replaced = await replaceTodoById(database.db, created.value.id, {
      title: "New title",
      completed: true,
    });
    if (replaced.isErr()) throw replaced.error;

    expect(replaced.value.id).toBe(created.value.id);
    expect(replaced.value.createdAt).toBe(created.value.createdAt);
  });

  it("changes updated_at to a later timestamp", async () => {
    const created = await createTodo(database.db, { title: "Check updated_at bumps" });
    if (created.isErr()) throw created.error;

    const before = await database.db
      .select({ updatedAt: todos.updatedAt })
      .from(todos)
      .where(eq(todos.id, created.value.id));

    const replaced = await replaceTodoById(database.db, created.value.id, {
      title: "New title",
      completed: true,
    });
    if (replaced.isErr()) throw replaced.error;

    const after = await database.db
      .select({ updatedAt: todos.updatedAt })
      .from(todos)
      .where(eq(todos.id, created.value.id));

    expect(after[0]!.updatedAt.getTime()).toBeGreaterThan(before[0]!.updatedAt.getTime());
  });

  it("returns not_found for a random unused id and does not insert a row", async () => {
    const unusedId = "00000000-0000-0000-0000-000000000000";
    const before = await listTodos(database.db);
    if (before.isErr()) throw before.error;

    const result = await replaceTodoById(database.db, unusedId, {
      title: "Should not be created",
      completed: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "not_found", id: unusedId });
    }

    const after = await listTodos(database.db);
    if (after.isErr()) throw after.error;
    expect(after.value.totalItems).toBe(before.value.totalItems);
  });

  it("updates only the targeted row, leaving the other todo unchanged", async () => {
    const target = await createTodo(database.db, { title: "Target todo" });
    const other = await createTodo(database.db, { title: "Untouched todo" });
    if (target.isErr() || other.isErr()) throw new Error("setup failed");

    const replaced = await replaceTodoById(database.db, target.value.id, {
      title: "Target todo, replaced",
      completed: true,
    });
    if (replaced.isErr()) throw replaced.error;

    const untouched = await getTodoById(database.db, other.value.id);
    if (untouched.isErr()) throw untouched.error;

    expect(untouched.value).toEqual(other.value);
  });
});

describe("todos repository, patchTodoById", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("updates only title, leaving completed unchanged", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const patched = await patchTodoById(database.db, created.value.id, { title: "New title" });
    if (patched.isErr()) throw patched.error;

    expect(patched.value.title).toBe("New title");
    expect(patched.value.completed).toBe(created.value.completed);
  });

  it("updates only completed, leaving title unchanged", async () => {
    const created = await createTodo(database.db, { title: "Keep this title" });
    if (created.isErr()) throw created.error;

    const patched = await patchTodoById(database.db, created.value.id, { completed: true });
    if (patched.isErr()) throw patched.error;

    expect(patched.value.completed).toBe(true);
    expect(patched.value.title).toBe(created.value.title);
  });

  it("updates both title and completed when both are supplied", async () => {
    const created = await createTodo(database.db, { title: "Original title" });
    if (created.isErr()) throw created.error;

    const patched = await patchTodoById(database.db, created.value.id, {
      title: "New title",
      completed: true,
    });
    if (patched.isErr()) throw patched.error;

    expect(patched.value.title).toBe("New title");
    expect(patched.value.completed).toBe(true);
  });

  it("leaves id and createdAt unchanged", async () => {
    const created = await createTodo(database.db, { title: "Keep my id and createdAt" });
    if (created.isErr()) throw created.error;

    const patched = await patchTodoById(database.db, created.value.id, { title: "New title" });
    if (patched.isErr()) throw patched.error;

    expect(patched.value.id).toBe(created.value.id);
    expect(patched.value.createdAt).toBe(created.value.createdAt);
  });

  it("changes updated_at to a later timestamp, even for a single-field patch", async () => {
    const created = await createTodo(database.db, { title: "Check updated_at bumps" });
    if (created.isErr()) throw created.error;

    const before = await database.db
      .select({ updatedAt: todos.updatedAt })
      .from(todos)
      .where(eq(todos.id, created.value.id));

    const patched = await patchTodoById(database.db, created.value.id, { completed: true });
    if (patched.isErr()) throw patched.error;

    const after = await database.db
      .select({ updatedAt: todos.updatedAt })
      .from(todos)
      .where(eq(todos.id, created.value.id));

    expect(after[0]!.updatedAt.getTime()).toBeGreaterThan(before[0]!.updatedAt.getTime());
  });

  it("returns not_found for a random unused id and does not insert a row", async () => {
    const unusedId = "00000000-0000-0000-0000-000000000000";
    const before = await listTodos(database.db);
    if (before.isErr()) throw before.error;

    const result = await patchTodoById(database.db, unusedId, { title: "Should not be created" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "not_found", id: unusedId });
    }

    const after = await listTodos(database.db);
    if (after.isErr()) throw after.error;
    expect(after.value.totalItems).toBe(before.value.totalItems);
  });

  it("updates only the targeted row, leaving the other todo unchanged", async () => {
    const target = await createTodo(database.db, { title: "Target todo" });
    const other = await createTodo(database.db, { title: "Untouched todo" });
    if (target.isErr() || other.isErr()) throw new Error("setup failed");

    const patched = await patchTodoById(database.db, target.value.id, {
      title: "Target todo, patched",
    });
    if (patched.isErr()) throw patched.error;

    const untouched = await getTodoById(database.db, other.value.id);
    if (untouched.isErr()) throw untouched.error;

    expect(untouched.value).toEqual(other.value);
  });
});

describe("todos repository, deleteTodoById", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("removes the row so it can no longer be selected", async () => {
    const created = await createTodo(database.db, { title: "Doomed todo" });
    if (created.isErr()) throw created.error;

    const deleted = await deleteTodoById(database.db, created.value.id);
    expect(deleted.isOk()).toBe(true);

    const found = await getTodoById(database.db, created.value.id);
    expect(found.isErr()).toBe(true);
    if (found.isErr()) {
      expect(found.error).toEqual({ type: "not_found", id: created.value.id });
    }
  });

  it("returns not_found for a random unused id and deletes nothing", async () => {
    const unusedId = "00000000-0000-0000-0000-000000000000";
    const before = await listTodos(database.db);
    if (before.isErr()) throw before.error;

    const result = await deleteTodoById(database.db, unusedId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "not_found", id: unusedId });
    }

    const after = await listTodos(database.db);
    if (after.isErr()) throw after.error;
    expect(after.value.totalItems).toBe(before.value.totalItems);
  });

  it("deletes only the targeted row, leaving the other todo unchanged", async () => {
    const target = await createTodo(database.db, { title: "Target todo" });
    const other = await createTodo(database.db, { title: "Untouched todo" });
    if (target.isErr() || other.isErr()) throw new Error("setup failed");

    const deleted = await deleteTodoById(database.db, target.value.id);
    expect(deleted.isOk()).toBe(true);

    const untouched = await getTodoById(database.db, other.value.id);
    if (untouched.isErr()) throw untouched.error;
    expect(untouched.value).toEqual(other.value);
  });

  it("returns not_found on a second delete of the same id, final state has the row gone", async () => {
    const created = await createTodo(database.db, { title: "Delete me twice" });
    if (created.isErr()) throw created.error;

    const first = await deleteTodoById(database.db, created.value.id);
    expect(first.isOk()).toBe(true);

    const second = await deleteTodoById(database.db, created.value.id);
    expect(second.isErr()).toBe(true);
    if (second.isErr()) {
      expect(second.error).toEqual({ type: "not_found", id: created.value.id });
    }

    const found = await getTodoById(database.db, created.value.id);
    expect(found.isErr()).toBe(true);
  });
});

describe("todos repository, setAllTodosCompleted", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("marks every todo completed, updatedCount matches the seeded rows, id/title/createdAt unchanged", async () => {
    const first = await createTodo(database.db, { title: "First active todo" });
    const second = await createTodo(database.db, { title: "Second active todo" });
    const third = await createTodo(database.db, { title: "Third active todo" });
    if (first.isErr() || second.isErr() || third.isErr()) throw new Error("setup failed");

    const result = await setAllTodosCompleted(database.db, true);
    if (result.isErr()) throw result.error;

    expect(result.value).toEqual({ updatedCount: 3 });

    for (const created of [first.value, second.value, third.value]) {
      const found = await getTodoById(database.db, created.id);
      if (found.isErr()) throw found.error;

      expect(found.value.completed).toBe(true);
      expect(found.value.id).toBe(created.id);
      expect(found.value.title).toBe(created.title);
      expect(found.value.createdAt).toBe(created.createdAt);
    }
  });

  it("returns updatedCount: 0 on a repeat call once the collection already matches", async () => {
    const result = await setAllTodosCompleted(database.db, true);
    if (result.isErr()) throw result.error;

    expect(result.value).toEqual({ updatedCount: 0 });
  });

  it("marks every todo active, flipping only the ones that were completed", async () => {
    const fourth = await createTodo(database.db, { title: "Fourth, freshly active todo" });
    if (fourth.isErr()) throw fourth.error;

    const result = await setAllTodosCompleted(database.db, false);
    if (result.isErr()) throw result.error;

    expect(result.value).toEqual({ updatedCount: 3 });

    const stillActive = await getTodoById(database.db, fourth.value.id);
    if (stillActive.isErr()) throw stillActive.error;
    expect(stillActive.value.completed).toBe(false);
  });
});

describe("todos repository, setAllTodosCompleted, mixed collection", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("only updates the rows that differ, leaving matching rows' updated_at untouched", async () => {
    const alreadyCompleted = await createTodo(database.db, { title: "Already completed" });
    const stillActive = await createTodo(database.db, { title: "Still active" });
    if (alreadyCompleted.isErr() || stillActive.isErr()) throw new Error("setup failed");

    await database.db
      .update(todos)
      .set({ completed: true })
      .where(eq(todos.id, alreadyCompleted.value.id));

    const before = await database.db
      .select({ id: todos.id, updatedAt: todos.updatedAt })
      .from(todos);
    const beforeById = new Map(before.map((row) => [row.id, row.updatedAt.getTime()]));

    const result = await setAllTodosCompleted(database.db, true);
    if (result.isErr()) throw result.error;

    expect(result.value).toEqual({ updatedCount: 1 });

    const afterAlreadyCompleted = await getTodoById(database.db, alreadyCompleted.value.id);
    const afterStillActive = await getTodoById(database.db, stillActive.value.id);
    if (afterAlreadyCompleted.isErr() || afterStillActive.isErr()) {
      throw new Error("lookup failed");
    }

    expect(afterStillActive.value.completed).toBe(true);
    expect(afterAlreadyCompleted.value.completed).toBe(true);

    const afterRows = await database.db
      .select({ id: todos.id, updatedAt: todos.updatedAt })
      .from(todos);
    const afterById = new Map(afterRows.map((row) => [row.id, row.updatedAt.getTime()]));

    expect(afterById.get(alreadyCompleted.value.id)).toBe(
      beforeById.get(alreadyCompleted.value.id),
    );
    expect(afterById.get(stillActive.value.id)).toBeGreaterThan(
      beforeById.get(stillActive.value.id)!,
    );
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

    expect(listed.value.items).toEqual([]);
  });

  it("returns updatedCount: 0 for setAllTodosCompleted when no todos exist", async () => {
    const result = await setAllTodosCompleted(database.db, true);
    if (result.isErr()) throw result.error;

    expect(result.value).toEqual({ updatedCount: 0 });
  });
});
