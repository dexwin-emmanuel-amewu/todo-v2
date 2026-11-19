import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api/todo.api";
import { useDeleteSelectedTodosMutation } from "./useDeleteSelectedTodosMutation";

const id = "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a";

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 3, retryDelay: 0 } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

describe("useDeleteSelectedTodosMutation", () => {
  it("sends the ids and refreshes the list prefix on success", async () => {
    const spy = vi.spyOn(api, "deleteSelectedTodos").mockResolvedValue({ deletedCount: 1 });
    const { client, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeleteSelectedTodosMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ ids: [id] })).resolves.toEqual({
        deletedCount: 1,
      });
    });

    expect(spy).toHaveBeenCalledWith({ ids: [id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] });
    client.clear();
  });

  it("refreshes the list prefix after a conflict and does not retry", async () => {
    const spy = vi
      .spyOn(api, "deleteSelectedTodos")
      .mockRejectedValue(
        new api.TodoApiError("batch_conflict", "missing", { status: 409, missingIds: [id] }),
      );
    const { client, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeleteSelectedTodosMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ids: [id] }).catch(() => {});
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["todos", "list"] });
    client.clear();
  });

  it("logs an unknown error but not a TodoApiError", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi.spyOn(api, "deleteSelectedTodos");
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteSelectedTodosMutation(), { wrapper });

    spy.mockRejectedValueOnce(new api.TodoApiError("network", "offline"));
    await act(async () => {
      await result.current.mutateAsync({ ids: [id] }).catch(() => {});
    });
    expect(log).not.toHaveBeenCalled();

    spy.mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.mutateAsync({ ids: [id] }).catch(() => {});
    });
    expect(log).toHaveBeenCalledWith(
      "Unexpected error while deleting the selected todos",
      expect.any(Error),
    );
    client.clear();
  });
});
