import { describe, expect, it } from "vitest";

import { getTodoListSearch, getTodoStatusFilter } from "./todo.filter";

describe("getTodoListSearch", () => {
  it("keeps the active and completed filters", () => {
    expect(getTodoListSearch({ status: "active" })).toEqual({ status: "active" });
    expect(getTodoListSearch({ status: "completed" })).toEqual({ status: "completed" });
  });

  it("drops the status param for all, a missing value, or a bad value", () => {
    expect(getTodoListSearch({ status: "all" })).toEqual({});
    expect(getTodoListSearch({})).toEqual({});
    expect(getTodoListSearch({ status: "done" })).toEqual({});
    expect(getTodoListSearch({ status: 1 })).toEqual({});
    expect(getTodoListSearch({ status: ["active"] })).toEqual({});
  });

  it("sets status even when it is dropped so a raw URL value cannot leak through", () => {
    expect(getTodoListSearch({ status: "done" })).toHaveProperty("status", undefined);
  });
});

describe("getTodoListSearch search text", () => {
  it("keeps a trimmed search", () => {
    expect(getTodoListSearch({ search: "  milk " })).toEqual({ search: "milk" });
  });

  it("keeps the search together with the status", () => {
    expect(getTodoListSearch({ status: "active", search: "milk" })).toEqual({
      status: "active",
      search: "milk",
    });
  });

  it("drops a blank, missing, bad, or too long search", () => {
    expect(getTodoListSearch({ search: "   " })).toEqual({});
    expect(getTodoListSearch({})).toEqual({});
    expect(getTodoListSearch({ search: ["a"] })).toEqual({});
    expect(getTodoListSearch({ search: "a".repeat(101) })).toEqual({});
  });

  it("turns numbers and booleans parsed from the URL back into text", () => {
    expect(getTodoListSearch({ search: 123 })).toEqual({ search: "123" });
    expect(getTodoListSearch({ search: true })).toEqual({ search: "true" });
  });
});

describe("getTodoStatusFilter", () => {
  it("reads all when no status is set", () => {
    expect(getTodoStatusFilter({})).toBe("all");
    expect(getTodoStatusFilter({ status: "completed" })).toBe("completed");
  });
});
