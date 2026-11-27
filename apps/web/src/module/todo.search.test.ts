import { describe, expect, it } from "vitest";

import { getTodoListPageLink, getTodoListSearchLink, normalizeSearch } from "./todo.search";

describe("normalizeSearch", () => {
  it("trims the text", () => {
    expect(normalizeSearch("  milk  ")).toEqual({ ok: true, value: "milk" });
  });

  it("treats blank and whitespace as no search", () => {
    expect(normalizeSearch("")).toEqual({ ok: true, value: undefined });
    expect(normalizeSearch("   ")).toEqual({ ok: true, value: undefined });
  });

  it("accepts 100 characters and rejects 101", () => {
    expect(normalizeSearch("a".repeat(100))).toEqual({ ok: true, value: "a".repeat(100) });
    expect(normalizeSearch("a".repeat(101))).toEqual({ ok: false });
  });

  it("rejects values that are not text", () => {
    expect(normalizeSearch(undefined)).toEqual({ ok: false });
    expect(normalizeSearch(12)).toEqual({ ok: false });
  });
});

describe("getTodoListSearchLink", () => {
  it("keeps the status and the search", () => {
    expect(getTodoListSearchLink({ status: "active", search: "milk" })).toEqual({
      status: "active",
      search: "milk",
    });
  });

  it("drops an all status and a missing search", () => {
    expect(getTodoListSearchLink({ status: "all", search: undefined })).toEqual({});
  });

  it("never carries a page", () => {
    const link = getTodoListSearchLink({ status: "active", search: "milk", page: 3 } as never);

    expect(link).not.toHaveProperty("page");
  });
});

describe("getTodoListSearchLink with a page size", () => {
  it("keeps the page size", () => {
    expect(getTodoListSearchLink({ status: "active", pageSize: 10 })).toEqual({
      status: "active",
      pageSize: 10,
    });
  });
});

describe("getTodoListPageLink", () => {
  it("adds the page to the status, search, and page size", () => {
    expect(
      getTodoListPageLink({ status: "active", search: "milk", pageSize: 10, page: 3 }),
    ).toEqual({ status: "active", search: "milk", pageSize: 10, page: 3 });
  });

  it("leaves out page 1 and a missing page", () => {
    expect(getTodoListPageLink({ page: 1 })).toEqual({});
    expect(getTodoListPageLink({})).toEqual({});
  });
});
