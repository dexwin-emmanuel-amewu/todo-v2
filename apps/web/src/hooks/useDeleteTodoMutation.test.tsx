import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeleteTodoMutation } from "./useDeleteTodoMutation";

const todoId = "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a";
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function setup(options: ConstructorParameters<typeof QueryClient>[0] = {}) {
  const client = new QueryClient(options);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { client, invalidate, result };
}

describe("useDeleteTodoMutation", () => {
  it("deletes the todo and invalidates the list query", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { client, invalidate, result } = setup();

    await act(async () => {
      await result.current.mutateAsync(todoId);
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it("invalidates the list after a 404 so stale rows are reconciled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    const { client, invalidate, result } = setup();

    await act(async () => {
      await expect(result.current.mutateAsync(todoId)).rejects.toMatchObject({
        type: "http",
        status: 404,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] });
    client.clear();
  });

  it("does not invalidate the list after other failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const { client, invalidate, result } = setup();

    await act(async () => {
      await expect(result.current.mutateAsync(todoId)).rejects.toMatchObject({ status: 500 });
    });

    expect(invalidate).not.toHaveBeenCalled();
    client.clear();
  });

  it("does not automatically retry failed DELETE requests", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    const { client, result } = setup({
      defaultOptions: { mutations: { retry: 3, retryDelay: 0 } },
    });

    await act(async () => {
      await expect(result.current.mutateAsync(todoId)).rejects.toMatchObject({ type: "network" });
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
