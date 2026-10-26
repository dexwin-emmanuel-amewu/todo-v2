import type { Todo, TodoListResponse } from "@todo/contracts";
import { match, P } from "ts-pattern";
import type { TodoApiError } from "../api/todo.api";

export type TodoListQuerySnapshot = {
  status: "pending" | "error" | "success";
  isFetching: boolean;
  isPlaceholderData: boolean;
  data: TodoListResponse | undefined;
  error: TodoApiError | null;
  refetch: () => void;
};

export type TodoListViewState =
  | { state: "initial_loading" }
  | { state: "initial_failure"; error: TodoApiError | null; retry: () => void }
  | { state: "loading_filter"; items: Todo[] }
  | { state: "ready"; items: Todo[] }
  | { state: "refreshing"; items: Todo[] }
  | { state: "refresh_failure"; items: Todo[]; error: TodoApiError | null; retry: () => void };

export function getTodoListViewState(snapshot: TodoListQuerySnapshot): TodoListViewState {
  return match(snapshot)
    .with({ status: "pending" }, (): TodoListViewState => ({ state: "initial_loading" }))
    .with(
      { status: "success", data: P.nonNullable, isPlaceholderData: true },
      ({ data }): TodoListViewState => ({ state: "loading_filter", items: data.items }),
    )
    .with({ status: "error", data: P.nullish }, ({ error, refetch }): TodoListViewState => ({
      state: "initial_failure",
      error,
      retry: refetch,
    }))
    .with(
      { status: "error", data: P.nonNullable },
      ({ data, error, refetch }): TodoListViewState => ({
        state: "refresh_failure",
        items: data.items,
        error,
        retry: refetch,
      }),
    )
    .with(
      { status: "success", data: P.nonNullable, isFetching: true },
      ({ data }): TodoListViewState => ({ state: "refreshing", items: data.items }),
    )
    .with(
      { status: "success", data: P.nonNullable, isFetching: false },
      ({ data }): TodoListViewState => ({ state: "ready", items: data.items }),
    )
    .with({ status: "success", data: P.nullish }, ({ error, refetch }): TodoListViewState => ({
      state: "initial_failure",
      error,
      retry: refetch,
    }))
    .exhaustive();
}
