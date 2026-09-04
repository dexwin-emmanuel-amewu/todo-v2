import { describe, expect, it } from "vitest";
import {
  notFoundErrorResponseSchema,
  todoIdParamSchema,
  todoSchema,
  todoSearchQuerySchema,
  todoStatusFilterSchema,
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
