import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TodoStatusFilter } from "@todo/contracts";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const items = url.endsWith("status=active")
      ? [activeTodo]
      : url.endsWith("status=completed")
        ? [completedTodo]
        : [activeTodo, completedTodo];
    return new Response(JSON.stringify(listBody(items)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function renderListHook(initialStatus: TodoStatusFilter) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(({ status }) => useTodoListQuery(status), {
    wrapper,
    initialProps: { status: initialStatus },
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
    expect(getTodoListQueryKey("all")).toEqual(["todos", "list", { status: "all" }]);
    expect(getTodoListQueryKey("active")).toEqual(["todos", "list", { status: "active" }]);
    expect(getTodoListQueryKey("completed")).toEqual(["todos", "list", { status: "completed" }]);
    expect(getTodoListQueryKey("active").slice(0, 2)).toEqual([...todoListQueryKey]);
  });
});

describe("useTodoListQuery", () => {
  it("requests the selected filter from the server", async () => {
    respondByStatus();
    const { result } = renderListHook("completed");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch().mock.calls[0][0]).toBe("/todos?status=completed");
    expect(result.current.data?.items).toEqual([completedTodo]);
  });

  it("keeps the previous list as placeholder data while a new filter loads", async () => {
    respondByStatus();
    const { result, rerender } = renderListHook("all");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ status: "active" });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items).toEqual([activeTodo, completedTodo]);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.items).toEqual([activeTodo]);
  });

  it("keeps each filter's result in its own cache entry", async () => {
    respondByStatus();
    const { result, rerender, queryClient } = renderListHook("active");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ status: "completed" });
    await waitFor(() => expect(result.current.data?.items).toEqual([completedTodo]));

    expect(queryClient.getQueryData(getTodoListQueryKey("active"))).toEqual(listBody([activeTodo]));
    expect(queryClient.getQueryData(getTodoListQueryKey("completed"))).toEqual(
      listBody([completedTodo]),
    );
  });

  it("refetches the filtered list when the list prefix is invalidated", async () => {
    respondByStatus();
    const { result, queryClient } = renderListHook("active");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await queryClient.invalidateQueries({ queryKey: todoListQueryKey });

    expect(mockFetch()).toHaveBeenCalledTimes(2);
    expect(mockFetch().mock.calls[1][0]).toBe("/todos?status=active");
  });
});
