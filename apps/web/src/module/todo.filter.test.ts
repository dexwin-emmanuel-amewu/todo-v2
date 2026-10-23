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

describe("getTodoStatusFilter", () => {
  it("reads all when no status is set", () => {
    expect(getTodoStatusFilter({})).toBe("all");
    expect(getTodoStatusFilter({ status: "completed" })).toBe("completed");
  });
});
