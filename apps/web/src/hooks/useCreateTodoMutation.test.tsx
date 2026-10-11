import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateTodoMutation } from "./useCreateTodoMutation";

const todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Buy oat milk",
  completed: false,
  createdAt: "2026-09-30T10:00:00.000Z",
};

function jsonResponse(body: unknown, status = 201): Response {
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

describe("useCreateTodoMutation", () => {
  it("creates a todo and refreshes the list query", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(todo));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateTodoMutation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync("Buy oat milk");
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
