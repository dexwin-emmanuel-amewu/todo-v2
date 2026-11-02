import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  getPageRange,
  getPageRedirect,
  normalizePage,
  normalizePageSize,
} from "./todo.pagination";

describe("normalizePage", () => {
  it("accepts whole numbers and digit text", () => {
    expect(normalizePage(2)).toEqual({ ok: true, value: 2 });
    expect(normalizePage("2")).toEqual({ ok: true, value: 2 });
    expect(normalizePage("02")).toEqual({ ok: true, value: 2 });
  });

  it("treats page 1 and a missing page as the default", () => {
    expect(normalizePage(1)).toEqual({ ok: true, value: undefined });
    expect(normalizePage("1")).toEqual({ ok: true, value: undefined });
    expect(normalizePage(undefined)).toEqual({ ok: true, value: undefined });
  });

  it.each([0, -1, 1.5, "abc", true, null, "", "1e1", "0x10", " 2", ["2"], Number.MAX_VALUE])(
    "rejects %s",
    (value) => {
      expect(normalizePage(value)).toEqual({ ok: false });
    },
  );
});

describe("normalizePageSize", () => {
  it("accepts the offered sizes", () => {
    for (const size of [10, 50, 100]) {
      expect(normalizePageSize(size)).toEqual({ ok: true, value: size });
      expect(normalizePageSize(String(size))).toEqual({ ok: true, value: size });
    }
  });

  it("treats 20 and a missing size as the default", () => {
    expect(normalizePageSize(20)).toEqual({ ok: true, value: undefined });
    expect(normalizePageSize(undefined)).toEqual({ ok: true, value: undefined });
  });

  it.each([7, 30, 500, 0, "abc", true, null])("rejects %s", (value) => {
    expect(normalizePageSize(value)).toEqual({ ok: false });
  });

  it("offers 10, 20, 50, and 100 with 20 as the default", () => {
    expect(PAGE_SIZES).toEqual([10, 20, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });
});

describe("getPageRange", () => {
  it("returns the first and last row number of a full page", () => {
    expect(getPageRange({ page: 2, pageSize: 20, itemCount: 20 })).toEqual({ start: 21, end: 40 });
  });

  it("returns a short last page", () => {
    expect(getPageRange({ page: 5, pageSize: 20, itemCount: 7 })).toEqual({ start: 81, end: 87 });
  });
});

describe("getPageRedirect", () => {
  it("moves a page past the end to the last page", () => {
    expect(getPageRedirect({ page: 9, totalPages: 3, totalItems: 50 })).toBe(3);
  });

  it("moves an empty list to page 1", () => {
    expect(getPageRedirect({ page: 3, totalPages: 0, totalItems: 0 })).toBe(1);
  });

  it("returns nothing for a page in range", () => {
    expect(getPageRedirect({ page: 3, totalPages: 3, totalItems: 50 })).toBeUndefined();
    expect(getPageRedirect({ page: 1, totalPages: 0, totalItems: 0 })).toBeUndefined();
  });
});
