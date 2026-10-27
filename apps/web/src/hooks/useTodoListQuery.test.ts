import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TodoListParams } from "../api/todo.api";
import { getTodoListQueryKey, todoListQueryKey, useTodoListQuery } from "./useTodoListQuery";

const activeTodo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Buy oat milk",
  completed: false,
  createdAt: "2026-09-30T10:00:00.000Z",
};

const completedTodo = {
  id: "6e2d4c3b-7c2b-4c8b-8c2b-7c2b4c8b8c2b",
  title: "Water the plants",
  completed: true,
  createdAt: "2026-09-30T11:00:00.000Z",
};

function listBody(items: (typeof activeTodo)[]) {
  return { items, page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 };
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

function respondByStatus() {
  mockFetch().mockImplementation(async (url: string) => {
    const search = new URL(url, "http://localhost").searchParams.get("search");
    const all = url.includes("status=active")
      ? [activeTodo]
      : url.includes("status=completed")
        ? [completedTodo]
        : [activeTodo, completedTodo];
    const items = search
      ? all.filter((todo) => todo.title.toLowerCase().includes(search.toLowerCase()))
      : all;
    return new Response(JSON.stringify(listBody(items)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function renderListHook(initialParams: TodoListParams) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(({ params }) => useTodoListQuery(params), {
    wrapper,
    initialProps: { params: initialParams },
  });
  return { ...hook, queryClient };
}

describe("todoListQueryKey", () => {
  it("is the todos list key", () => {
    expect(todoListQueryKey).toEqual(["todos", "list"]);
  });
});

describe("getTodoListQueryKey", () => {
  it("gives each filter its own key under the list prefix", () => {
    expect(getTodoListQueryKey({ status: "all" })).toEqual(["todos", "list", { status: "all" }]);
    expect(getTodoListQueryKey({ status: "active" })).toEqual([
      "todos",
      "list",
      { status: "active" },
    ]);
    expect(getTodoListQueryKey({ status: "completed" })).toEqual([
      "todos",
      "list",
      { status: "completed" },
    ]);
    expect(getTodoListQueryKey({ status: "active" }).slice(0, 2)).toEqual([...todoListQueryKey]);
  });
});

describe("getTodoListQueryKey with a search", () => {
  it("adds the search to the key under the list prefix", () => {
    const key = getTodoListQueryKey({ status: "active", search: "milk" });

    expect(key).toEqual(["todos", "list", { status: "active", search: "milk" }]);
    expect(key.slice(0, 2)).toEqual([...todoListQueryKey]);
  });

  it("gives different keys to searches that differ only in case", () => {
    expect(getTodoListQueryKey({ search: "Milk" })).not.toEqual(
      getTodoListQueryKey({ search: "milk" }),
    );
  });
});

describe("useTodoListQuery", () => {
  it("requests the selected filter from the server", async () => {
    respondByStatus();
    const { result } = renderListHook({ status: "completed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch().mock.calls[0][0]).toBe("/todos?status=completed");
    expect(result.current.data?.items).toEqual([completedTodo]);
  });

  it("keeps the previous data as placeholder while a new filter loads", async () => {
    respondByStatus();
    const { result, rerender } = renderListHook({ status: "all" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ params: { status: "active" } });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items).toEqual([activeTodo, completedTodo]);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.items).toEqual([activeTodo]);
  });

  it("requests the status and the search together", async () => {
    respondByStatus();
    const { result } = renderListHook({ status: "active", search: "milk" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch().mock.calls[0][0]).toBe("/todos?status=active&search=milk");
    expect(result.current.data?.items).toEqual([activeTodo]);
  });

  it("keeps the previous data while a new search loads", async () => {
    respondByStatus();
    const { result, rerender } = renderListHook({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ params: { search: "plants" } });

    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.items).toEqual([completedTodo]));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("does not show old data when the new query fails", async () => {
    respondByStatus();
    const { result, rerender } = renderListHook({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mockFetch().mockResolvedValue(new Response("{}", { status: 500 }));

    rerender({ params: { search: "boom" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("goes back to the unsearched list when the search is cleared", async () => {
    respondByStatus();
    const { result, rerender } = renderListHook({ search: "plants" });
    await waitFor(() => expect(result.current.data?.items).toEqual([completedTodo]));

    rerender({ params: {} });

    await waitFor(() => expect(result.current.data?.items).toEqual([activeTodo, completedTodo]));
  });

  it("keeps each filter's result in its own cache entry", async () => {
    respondByStatus();
    const { result, rerender, queryClient } = renderListHook({ status: "active" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ params: { status: "completed" } });
    await waitFor(() => expect(result.current.data?.items).toEqual([completedTodo]));

    expect(queryClient.getQueryData(getTodoListQueryKey({ status: "active" }))).toEqual(
      listBody([activeTodo]),
    );
    expect(queryClient.getQueryData(getTodoListQueryKey({ status: "completed" }))).toEqual(
      listBody([completedTodo]),
    );
  });

  it("refetches the filtered list when the list prefix is invalidated", async () => {
    respondByStatus();
    const { result, queryClient } = renderListHook({ status: "active" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await queryClient.invalidateQueries({ queryKey: todoListQueryKey });

    expect(mockFetch()).toHaveBeenCalledTimes(2);
    expect(mockFetch().mock.calls[1][0]).toBe("/todos?status=active");
  });
});
