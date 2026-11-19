import { describe, expect, it } from "vitest";
import {
  batchConflictErrorResponseSchema,
  clearCompletedTodosResponseSchema,
  deleteSelectedTodosResponseSchema,
  deleteSelectedTodosSchema,
  notFoundErrorResponseSchema,
  patchTodoSchema,
  replaceTodoSchema,
  setAllTodosCompletedResponseSchema,
  setAllTodosCompletedSchema,
  todoIdParamSchema,
  todoSchema,
  todoSearchQuerySchema,
  todoStatusFilterSchema,
  updateSelectedTodosResponseSchema,
  updateSelectedTodosSchema,
} from "./index";

describe("todoSchema", () => {
  it("parses a valid todo", () => {
    const result = todoSchema.safeParse({
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      title: "Example",
      completed: false,
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });
});

describe("todoStatusFilterSchema", () => {
  it.each(["all", "active", "completed"])("accepts %s", (value) => {
    expect(todoStatusFilterSchema.safeParse(value).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(todoStatusFilterSchema.safeParse("bogus").success).toBe(false);
  });

  it("rejects an array, the shape a duplicate query param takes", () => {
    expect(todoStatusFilterSchema.safeParse(["active", "completed"]).success).toBe(false);
  });
});

describe("todoSearchQuerySchema", () => {
  it("accepts a term at the length limit", () => {
    expect(todoSearchQuerySchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  it("rejects a term one character over the length limit", () => {
    expect(todoSearchQuerySchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("trims leading and trailing whitespace", () => {
    const result = todoSearchQuerySchema.safeParse("  milestone  ");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("milestone");
    }
  });

  it("rejects an array, the shape a duplicate query param takes", () => {
    expect(todoSearchQuerySchema.safeParse(["a", "b"]).success).toBe(false);
  });
});

describe("replaceTodoSchema", () => {
  it("accepts a valid title and completed", () => {
    expect(replaceTodoSchema.safeParse({ title: "Buy oat milk", completed: false }).success).toBe(
      true,
    );
  });

  it("rejects a missing title", () => {
    expect(replaceTodoSchema.safeParse({ completed: false }).success).toBe(false);
  });

  it("rejects a missing completed", () => {
    expect(replaceTodoSchema.safeParse({ title: "Buy oat milk" }).success).toBe(false);
  });

  it("rejects a title under 6 characters after trimming", () => {
    expect(replaceTodoSchema.safeParse({ title: "hi", completed: false }).success).toBe(false);
  });

  it("rejects a title over 100 characters", () => {
    expect(replaceTodoSchema.safeParse({ title: "a".repeat(101), completed: false }).success).toBe(
      false,
    );
  });

  it("rejects a completed value that isn't a boolean", () => {
    expect(replaceTodoSchema.safeParse({ title: "Buy oat milk", completed: "true" }).success).toBe(
      false,
    );
  });

  it("strips an extra id and createdAt instead of rejecting the body", () => {
    const result = replaceTodoSchema.safeParse({
      title: "Buy oat milk",
      completed: false,
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: "Buy oat milk", completed: false });
    }
  });
});

describe("patchTodoSchema", () => {
  it("accepts a title alone", () => {
    expect(patchTodoSchema.safeParse({ title: "Buy oat milk" }).success).toBe(true);
  });

  it("accepts a completed value alone", () => {
    expect(patchTodoSchema.safeParse({ completed: true }).success).toBe(true);
  });

  it("accepts both title and completed together", () => {
    expect(patchTodoSchema.safeParse({ title: "Buy oat milk", completed: true }).success).toBe(
      true,
    );
  });

  it("rejects an empty object", () => {
    expect(patchTodoSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a body containing only unrecognized fields, the same as an empty body", () => {
    expect(patchTodoSchema.safeParse({ notes: "x" }).success).toBe(false);
  });

  it("rejects a title under 6 characters after trimming, when title is present", () => {
    expect(patchTodoSchema.safeParse({ title: "hi" }).success).toBe(false);
  });

  it("rejects a title over 100 characters, when title is present", () => {
    expect(patchTodoSchema.safeParse({ title: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects a completed value that isn't a boolean, when completed is present", () => {
    expect(patchTodoSchema.safeParse({ completed: "true" }).success).toBe(false);
  });

  it("strips an extra id and createdAt but still accepts the body when title is also present", () => {
    const result = patchTodoSchema.safeParse({
      title: "Buy oat milk",
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: "Buy oat milk" });
    }
  });

  it("accepts a title-only body that replaceTodoSchema rejects for missing completed", () => {
    const body = { title: "Buy oat milk" };

    expect(patchTodoSchema.safeParse(body).success).toBe(true);
    expect(replaceTodoSchema.safeParse(body).success).toBe(false);
  });
});

describe("setAllTodosCompletedSchema", () => {
  it("accepts completed: true", () => {
    expect(setAllTodosCompletedSchema.safeParse({ completed: true }).success).toBe(true);
  });

  it("accepts completed: false", () => {
    expect(setAllTodosCompletedSchema.safeParse({ completed: false }).success).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(setAllTodosCompletedSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a completed value that isn't a boolean", () => {
    expect(setAllTodosCompletedSchema.safeParse({ completed: "true" }).success).toBe(false);
  });

  it("strips an extra field but still accepts the body", () => {
    const result = setAllTodosCompletedSchema.safeParse({ completed: true, notes: "x" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ completed: true });
    }
  });
});

describe("setAllTodosCompletedResponseSchema", () => {
  it("accepts updatedCount: 0", () => {
    expect(setAllTodosCompletedResponseSchema.safeParse({ updatedCount: 0 }).success).toBe(true);
  });

  it("rejects a negative updatedCount", () => {
    expect(setAllTodosCompletedResponseSchema.safeParse({ updatedCount: -1 }).success).toBe(false);
  });
});

describe("todoIdParamSchema", () => {
  it("accepts a well-formed uuid", () => {
    expect(todoIdParamSchema.safeParse("5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a").success).toBe(true);
  });

  it.each(["abc", "123", "", "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1"])("rejects %s", (value) => {
    expect(todoIdParamSchema.safeParse(value).success).toBe(false);
  });

  it("rejects an array, the shape a repeated path segment would take", () => {
    expect(todoIdParamSchema.safeParse(["5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a"]).success).toBe(
      false,
    );
  });
});

describe("notFoundErrorResponseSchema", () => {
  it("accepts the not_found body", () => {
    expect(notFoundErrorResponseSchema.safeParse({ error: { type: "not_found" } }).success).toBe(
      true,
    );
  });

  it("rejects a different error type", () => {
    expect(notFoundErrorResponseSchema.safeParse({ error: { type: "internal" } }).success).toBe(
      false,
    );
  });

  it("rejects a body that leaks the requested id", () => {
    const result = notFoundErrorResponseSchema.safeParse({
      error: { type: "not_found", id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error).toEqual({ type: "not_found" });
    }
  });
});

describe("clearCompletedTodosResponseSchema", () => {
  it.each([0, 7])("accepts a deletedCount of %i", (deletedCount) => {
    expect(clearCompletedTodosResponseSchema.safeParse({ deletedCount }).success).toBe(true);
  });

  it.each([-1, 1.5])("rejects a deletedCount of %s", (deletedCount) => {
    expect(clearCompletedTodosResponseSchema.safeParse({ deletedCount }).success).toBe(false);
  });

  it("rejects a body with no deletedCount", () => {
    expect(clearCompletedTodosResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateSelectedTodosSchema", () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const ids = (count: number) => Array.from({ length: count }, (_, n) => id(n));

  it("accepts 1 id and 100 ids", () => {
    expect(updateSelectedTodosSchema.safeParse({ ids: ids(1), completed: true }).success).toBe(
      true,
    );
    expect(updateSelectedTodosSchema.safeParse({ ids: ids(100), completed: false }).success).toBe(
      true,
    );
  });

  it.each([
    ["no ids", { ids: [], completed: true }],
    ["101 ids", { ids: ids(101), completed: true }],
    ["a duplicate id", { ids: [id(1), id(1)], completed: true }],
    ["a non-UUID id", { ids: ["not-a-uuid"], completed: true }],
    ["a missing completed", { ids: ids(1) }],
    ["a string completed", { ids: ids(1), completed: "true" }],
    ["a non-object body", "ids"],
  ])("rejects %s", (_, body) => {
    expect(updateSelectedTodosSchema.safeParse(body).success).toBe(false);
  });

  it("names the duplicate issue", () => {
    const result = updateSelectedTodosSchema.safeParse({ ids: [id(1), id(1)], completed: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("ids must be unique");
    }
  });
});

describe("updateSelectedTodosResponseSchema", () => {
  it("accepts a count from 1 to 100 and rejects 0", () => {
    expect(updateSelectedTodosResponseSchema.safeParse({ updatedCount: 1 }).success).toBe(true);
    expect(updateSelectedTodosResponseSchema.safeParse({ updatedCount: 100 }).success).toBe(true);
    expect(updateSelectedTodosResponseSchema.safeParse({ updatedCount: 0 }).success).toBe(false);
  });
});

describe("batchConflictErrorResponseSchema", () => {
  it("accepts a conflict body and rejects an empty missingIds", () => {
    const missing = "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a";

    expect(
      batchConflictErrorResponseSchema.safeParse({
        error: { type: "batch_conflict", missingIds: [missing] },
      }).success,
    ).toBe(true);
    expect(
      batchConflictErrorResponseSchema.safeParse({
        error: { type: "batch_conflict", missingIds: [] },
      }).success,
    ).toBe(false);
  });
});

describe("deleteSelectedTodosSchema", () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const ids = (count: number) => Array.from({ length: count }, (_, n) => id(n));

  it("accepts 1 id and 100 ids", () => {
    expect(deleteSelectedTodosSchema.safeParse({ ids: ids(1) }).success).toBe(true);
    expect(deleteSelectedTodosSchema.safeParse({ ids: ids(100) }).success).toBe(true);
  });

  it.each([
    ["no ids", { ids: [] }],
    ["101 ids", { ids: ids(101) }],
    ["a duplicate id", { ids: [id(1), id(1)] }],
    ["a non-UUID id", { ids: ["not-a-uuid"] }],
    ["a missing ids", {}],
    ["a non-object body", "ids"],
  ])("rejects %s", (_, body) => {
    expect(deleteSelectedTodosSchema.safeParse(body).success).toBe(false);
  });

  it("names the duplicate issue", () => {
    const result = deleteSelectedTodosSchema.safeParse({ ids: [id(1), id(1)] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("ids must be unique");
    }
  });
});

describe("deleteSelectedTodosResponseSchema", () => {
  it("accepts a count from 1 to 100 and rejects 0 and 101", () => {
    expect(deleteSelectedTodosResponseSchema.safeParse({ deletedCount: 1 }).success).toBe(true);
    expect(deleteSelectedTodosResponseSchema.safeParse({ deletedCount: 100 }).success).toBe(true);
    expect(deleteSelectedTodosResponseSchema.safeParse({ deletedCount: 0 }).success).toBe(false);
    expect(deleteSelectedTodosResponseSchema.safeParse({ deletedCount: 101 }).success).toBe(false);
  });
});
