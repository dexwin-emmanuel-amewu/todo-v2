import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTodoList, TODO_API_BASE_URL, TodoApiError } from "./todo.api";

const todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Buy oat milk",
  completed: false,
  createdAt: "2026-09-30T10:00:00.000Z",
};

const listBody = {
  items: [todo],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("fetchTodoList", () => {
  it("issues one GET to the todos path", async () => {
    mockFetch().mockResolvedValue(jsonResponse(listBody));

    await fetchTodoList();

    expect(mockFetch()).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch().mock.calls[0];
    expect(url).toBe(`${TODO_API_BASE_URL}/todos`);
    expect(url).toBe("/todos");
    expect(init).toMatchObject({ method: "GET" });
  });

  it("resolves the parsed list on a 200", async () => {
    mockFetch().mockResolvedValue(jsonResponse(listBody));

    await expect(fetchTodoList()).resolves.toEqual(listBody);
  });

  it("resolves an empty list without erroring", async () => {
    const empty = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
    mockFetch().mockResolvedValue(jsonResponse(empty));

    await expect(fetchTodoList()).resolves.toEqual(empty);
  });

  it("rejects with a network error when fetch rejects", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchTodoList()).rejects.toMatchObject({ type: "network" });
    await expect(fetchTodoList()).rejects.toBeInstanceOf(TodoApiError);
  });

  it("rejects with an http error on a 500 and never reads the body", async () => {
    const body = { error: { type: "internal" } };
    const response = jsonResponse(body, 500);
    const json = vi.spyOn(response, "json");
    const text = vi.spyOn(response, "text");
    mockFetch().mockResolvedValue(response);

    await expect(fetchTodoList()).rejects.toMatchObject({ type: "http", status: 500 });
    expect(json).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects with a response_validation error on invalid JSON", async () => {
    mockFetch().mockResolvedValue(
      new Response("not json", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(fetchTodoList()).rejects.toMatchObject({ type: "response_validation" });
  });

  it("rejects with issues when the envelope counts are missing", async () => {
    mockFetch().mockResolvedValue(jsonResponse({ items: [] }));

    await expect(fetchTodoList()).rejects.toMatchObject({ type: "response_validation" });

    mockFetch().mockResolvedValue(jsonResponse({ items: [] }));
    const caught = await fetchTodoList().then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(TodoApiError);
    expect((caught as TodoApiError).issues?.length).toBeGreaterThan(0);
  });

  it("rejects when an item has a malformed id", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ ...listBody, items: [{ ...todo, id: "not-a-uuid" }] }),
    );

    await expect(fetchTodoList()).rejects.toMatchObject({ type: "response_validation" });
  });
});
