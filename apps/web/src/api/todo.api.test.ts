import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTodo,
  deleteTodo,
  fetchTodoList,
  patchTodoCompletion,
  replaceTodo,
  TODO_API_BASE_URL,
  TodoApiError,
} from "./todo.api";

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

describe("createTodo", () => {
  const todo = {
    id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
    title: "Buy oat milk",
    completed: false,
    createdAt: "2026-09-30T10:00:00.000Z",
  };

  it("posts the title and parses the created todo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(todo, 201));
    globalThis.fetch = fetchMock;

    await expect(createTodo(" Buy oat milk ")).resolves.toEqual(todo);
    expect(fetchMock).toHaveBeenCalledWith(`${TODO_API_BASE_URL}/todos`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy oat milk" }),
    });
  });

  it("wraps network, HTTP, and invalid response failures", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(createTodo("Buy oat milk")).rejects.toMatchObject({ type: "network" });

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(createTodo("Buy oat milk")).rejects.toMatchObject({ type: "http", status: 500 });

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ title: "bad" }, 201));
    await expect(createTodo("Buy oat milk")).rejects.toMatchObject({
      type: "response_validation",
    });
  });
});

describe("patchTodoCompletion", () => {
  it("patches the completion value and parses the updated todo", async () => {
    const completedTodo = { ...todo, completed: true };
    mockFetch().mockResolvedValue(jsonResponse(completedTodo));

    await expect(patchTodoCompletion(todo.id, true)).resolves.toEqual(completedTodo);
    expect(mockFetch()).toHaveBeenCalledWith(`${TODO_API_BASE_URL}/todos/${todo.id}`, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
  });

  it("rejects invalid ids or bodies without making a request", async () => {
    await expect(patchTodoCompletion("not-a-uuid", true)).rejects.toMatchObject({
      type: "request_validation",
    });
    await expect(patchTodoCompletion(todo.id, "true" as unknown as boolean)).rejects.toMatchObject({
      type: "request_validation",
    });
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("wraps network, HTTP, and invalid response failures", async () => {
    mockFetch().mockRejectedValueOnce(new TypeError("offline"));
    await expect(patchTodoCompletion(todo.id, true)).rejects.toMatchObject({ type: "network" });

    mockFetch().mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(patchTodoCompletion(todo.id, true)).rejects.toMatchObject({
      type: "http",
      status: 404,
    });

    mockFetch().mockResolvedValueOnce(jsonResponse({ id: todo.id }));
    await expect(patchTodoCompletion(todo.id, true)).rejects.toMatchObject({
      type: "response_validation",
    });
  });
});

describe("replaceTodo", () => {
  it("sends the complete replacement body and parses the updated todo", async () => {
    const updatedTodo = { ...todo, title: "Buy oat milk tomorrow", completed: true };
    mockFetch().mockResolvedValue(jsonResponse(updatedTodo));

    await expect(replaceTodo(todo.id, " Buy oat milk tomorrow ", true)).resolves.toEqual(
      updatedTodo,
    );
    expect(mockFetch()).toHaveBeenCalledWith(`${TODO_API_BASE_URL}/todos/${todo.id}`, {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy oat milk tomorrow", completed: true }),
    });
  });

  it("rejects invalid ids and replacement data without calling fetch", async () => {
    await expect(replaceTodo("bad-id", "Buy oat milk", false)).rejects.toMatchObject({
      type: "request_validation",
    });
    await expect(replaceTodo(todo.id, "short", false)).rejects.toMatchObject({
      type: "request_validation",
    });
    await expect(
      replaceTodo(todo.id, "Buy oat milk", "false" as unknown as boolean),
    ).rejects.toMatchObject({ type: "request_validation" });
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("maps network, HTTP, and invalid response failures", async () => {
    mockFetch().mockRejectedValueOnce(new TypeError("offline"));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "network",
    });

    mockFetch().mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "http",
      status: 500,
    });

    mockFetch().mockResolvedValueOnce(jsonResponse({ id: todo.id }));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "response_validation",
    });
  });
});

describe("replaceTodo", () => {
  it("puts the complete mutable representation and parses the updated todo", async () => {
    const updatedTodo = { ...todo, title: "Buy oat milk", completed: true };
    mockFetch().mockResolvedValue(jsonResponse(updatedTodo));

    await expect(replaceTodo(todo.id, "  Buy oat milk  ", true)).resolves.toEqual(updatedTodo);
    expect(mockFetch()).toHaveBeenCalledWith(`${TODO_API_BASE_URL}/todos/${todo.id}`, {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy oat milk", completed: true }),
    });
  });

  it("rejects invalid ids or replacement bodies without making a request", async () => {
    await expect(replaceTodo("not-a-uuid", "Buy oat milk", false)).rejects.toMatchObject({
      type: "request_validation",
    });
    await expect(replaceTodo(todo.id, "abc", false)).rejects.toMatchObject({
      type: "request_validation",
    });
    await expect(
      replaceTodo(todo.id, "Buy oat milk", "false" as unknown as boolean),
    ).rejects.toMatchObject({ type: "request_validation" });
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("wraps network, HTTP, and invalid response failures", async () => {
    mockFetch().mockRejectedValueOnce(new TypeError("offline"));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "network",
    });

    mockFetch().mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "http",
      status: 500,
    });

    mockFetch().mockResolvedValueOnce(jsonResponse({ id: todo.id }));
    await expect(replaceTodo(todo.id, "Buy oat milk", false)).rejects.toMatchObject({
      type: "response_validation",
    });
  });
});

describe("deleteTodo", () => {
  it("sends a bodyless DELETE and resolves on 204 without reading the body", async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, "json");
    mockFetch().mockResolvedValue(response);

    await expect(deleteTodo(todo.id)).resolves.toBeUndefined();
    expect(mockFetch()).toHaveBeenCalledTimes(1);
    expect(mockFetch()).toHaveBeenCalledWith(`${TODO_API_BASE_URL}/todos/${todo.id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without making a request", async () => {
    await expect(deleteTodo("not-a-uuid")).rejects.toMatchObject({ type: "request_validation" });
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("wraps network and HTTP failures, including 404 and 500", async () => {
    mockFetch().mockRejectedValueOnce(new TypeError("offline"));
    await expect(deleteTodo(todo.id)).rejects.toMatchObject({ type: "network" });

    mockFetch().mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(deleteTodo(todo.id)).rejects.toMatchObject({ type: "http", status: 404 });

    mockFetch().mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(deleteTodo(todo.id)).rejects.toMatchObject({ type: "http", status: 500 });
  });
});
