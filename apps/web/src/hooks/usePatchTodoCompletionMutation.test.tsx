import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePatchTodoCompletionMutation } from "./usePatchTodoCompletionMutation";

const todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Buy oat milk",
  completed: true,
  createdAt: "2026-09-30T10:00:00.000Z",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("usePatchTodoCompletionMutation", () => {
  it("sends the completion update and refreshes the list without automatic retry", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(todo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePatchTodoCompletionMutation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ todoId: todo.id, completed: true });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it("does not repeat a failed request automatically", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 3, retryDelay: 0 } },
    });
    const { result } = renderHook(() => usePatchTodoCompletionMutation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ todoId: todo.id, completed: true }),
      ).rejects.toMatchObject({ type: "network" });
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
