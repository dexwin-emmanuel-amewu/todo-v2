import type { Todo, TodoListResponse } from "@todo/contracts";
import { describe, expect, it, vi } from "vitest";

import { TodoApiError } from "../api/todo.api";
import { getTodoListViewState, type TodoListQuerySnapshot } from "./todo.state";

const items: Todo[] = [
  {
    id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
    title: "Buy oat milk",
    completed: false,
    createdAt: "2026-09-30T10:00:00.000Z",
  },
  {
    id: "6e2d4c3b-7c2b-4c8b-8c2b-7c2b4c8b8c2b",
    title: "Water the plants",
    completed: true,
    createdAt: "2026-09-30T11:00:00.000Z",
  },
];

const data: TodoListResponse = {
  items,
  page: 1,
  pageSize: 20,
  totalItems: 2,
  totalPages: 1,
};

const emptyData: TodoListResponse = {
  items: [],
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
};

const error = new TodoApiError("network", "Could not reach the API.");

function snapshot(overrides: Partial<TodoListQuerySnapshot>): TodoListQuerySnapshot {
  return {
    status: "pending",
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("getTodoListViewState", () => {
  it("maps a pending query with no data to initial_loading", () => {
    const state = getTodoListViewState(snapshot({ status: "pending", isFetching: true }));

    expect(state).toEqual({ state: "initial_loading" });
  });

  it("maps an error with no data to initial_failure carrying the error", () => {
    const refetch = vi.fn();
    const state = getTodoListViewState(snapshot({ status: "error", error, refetch }));

    expect(state.state).toBe("initial_failure");
    if (state.state !== "initial_failure") throw new Error("wrong state");
    expect(state.error).toBe(error);
  });

  it("maps a settled success to ready carrying the items", () => {
    const state = getTodoListViewState(snapshot({ status: "success", isFetching: false, data }));

    expect(state).toEqual({ state: "ready", items });
  });

  it("maps a settled success with no items to ready with an empty list", () => {
    const state = getTodoListViewState(
      snapshot({ status: "success", isFetching: false, data: emptyData }),
    );

    expect(state).toEqual({ state: "ready", items: [] });
  });

  it("maps a success that is fetching to refreshing carrying the previous items", () => {
    const state = getTodoListViewState(snapshot({ status: "success", isFetching: true, data }));

    expect(state).toEqual({ state: "refreshing", items });
  });

  it("maps an error that still has data to refresh_failure carrying both", () => {
    const state = getTodoListViewState(snapshot({ status: "error", data, error }));

    expect(state.state).toBe("refresh_failure");
    if (state.state !== "refresh_failure") throw new Error("wrong state");
    expect(state.items).toEqual(items);
    expect(state.error).toBe(error);
  });

  it("treats a success that carries no data as an initial failure", () => {
    const refetch = vi.fn();
    const state = getTodoListViewState(
      snapshot({ status: "success", isFetching: false, data: undefined, refetch }),
    );

    expect(state.state).toBe("initial_failure");
  });

  it("passes the query's refetch through as retry on both failure states", () => {
    const refetch = vi.fn();

    const initial = getTodoListViewState(snapshot({ status: "error", error, refetch }));
    if (initial.state !== "initial_failure") throw new Error("wrong state");
    initial.retry();

    const refresh = getTodoListViewState(snapshot({ status: "error", data, error, refetch }));
    if (refresh.state !== "refresh_failure") throw new Error("wrong state");
    refresh.retry();

    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
