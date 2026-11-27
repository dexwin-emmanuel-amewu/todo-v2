import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTodoListQueryKey, todoListQueryKey } from "./useTodoListQuery";
import { todoSummaryQueryKey, useTodoSummaryQuery } from "./useTodoSummaryQuery";

function listBody(totalItems: number) {
  return { items: [], page: 1, pageSize: 1, totalItems, totalPages: totalItems };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("todoSummaryQueryKey", () => {
  it("starts with the list prefix and never matches a list key", () => {
    expect(todoSummaryQueryKey.slice(0, 2)).toEqual([...todoListQueryKey]);
    expect(todoSummaryQueryKey).not.toEqual(getTodoListQueryKey());
    expect(todoSummaryQueryKey).not.toEqual(getTodoListQueryKey({ status: "active", pageSize: 1 }));
  });
});

describe("useTodoSummaryQuery", () => {
  it("loads the counts and refetches when the list prefix is invalidated", async () => {
    let active = 3;
    globalThis.fetch = vi.fn(async (url: string) =>
      jsonResponse(listBody(url.includes("status=active") ? active : 12)),
    ) as unknown as typeof fetch;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTodoSummaryQuery(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.data).toEqual({ totalCount: 12, activeCount: 3 }));

    active = 0;
    await client.invalidateQueries({ queryKey: todoListQueryKey });

    await waitFor(() => expect(result.current.data).toEqual({ totalCount: 12, activeCount: 0 }));
    client.clear();
  });
});
