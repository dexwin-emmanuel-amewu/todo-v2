import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api/todo.api";
import { useClearCompletedTodosMutation } from "./useClearCompletedTodosMutation";
import { todoSummaryQueryKey } from "./useTodoSummaryQuery";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

describe("useClearCompletedTodosMutation", () => {
  it("sends the delete and refreshes the list prefix on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ deletedCount: 4 }));
    const { client, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useClearCompletedTodosMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).resolves.toEqual({ deletedCount: 4 });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it("stays pending until the summary refetches after success", async () => {
    let releaseSummary: () => void = () => {};
    let summaryCalls = 0;
    const { client, wrapper } = setup();
    vi.spyOn(api, "clearCompletedTodos").mockResolvedValue({ deletedCount: 4 });
    const { result } = renderHook(
      () => {
        useQuery({
          queryKey: todoSummaryQueryKey,
          queryFn: () => {
            summaryCalls += 1;
            if (summaryCalls === 1) return { totalCount: 1, activeCount: 0 };
            return new Promise((resolve) => {
              releaseSummary = () => resolve({ totalCount: 0, activeCount: 0 });
            });
          },
        });
        return useClearCompletedTodosMutation();
      },
      { wrapper },
    );

    await waitFor(() => expect(summaryCalls).toBe(1));
    act(() => result.current.mutate());

    await waitFor(() => expect(summaryCalls).toBe(2));
    expect(result.current.isPending).toBe(true);

    act(() => releaseSummary());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    client.clear();
  });

  it("refreshes the list prefix after a failure and does not retry", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { type: "internal" } }, 500));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 3, retryDelay: 0 } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useClearCompletedTodosMutation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        type: "http",
        status: 500,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it("logs an unknown error but not a TodoApiError", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, wrapper } = setup();
    const spy = vi.spyOn(api, "clearCompletedTodos");
    const { result } = renderHook(() => useClearCompletedTodosMutation(), { wrapper });

    spy.mockRejectedValueOnce(new api.TodoApiError("network", "offline"));
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    expect(log).not.toHaveBeenCalled();

    spy.mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    expect(log).toHaveBeenCalledWith(
      "Unexpected error while clearing completed todos",
      expect.any(Error),
    );
    client.clear();
  });
});
