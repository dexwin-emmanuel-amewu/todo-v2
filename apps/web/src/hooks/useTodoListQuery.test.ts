import { describe, expect, it } from "vitest";

import { todoListQueryKey } from "./useTodoListQuery";

describe("todoListQueryKey", () => {
  it("is the todos list key", () => {
    expect(todoListQueryKey).toEqual(["todos", "list"]);
  });
});
