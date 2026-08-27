import { describe, expect, it } from "vitest";
import { todoSchema, todoStatusFilterSchema } from "./index";

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
