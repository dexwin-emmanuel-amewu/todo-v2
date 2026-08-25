import { describe, expect, it } from "vitest";
import { todoSchema } from "./index";

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
