import { type TodoListResponse } from "@todo/contracts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { DEFAULT_PAGE_SIZE } from "../module/todo.pagination";
import { fetchTodoList, type TodoApiError, type TodoListParams } from "../api/todo.api";

export const todoListQueryKey = ["todos", "list"] as const;

export function getTodoListQueryKey({
  status = "all",
  search,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: TodoListParams = {}) {
  return [...todoListQueryKey, { status, search, page, pageSize }] as const;
}

export function useTodoListQuery(
  params: TodoListParams = {},
): UseQueryResult<TodoListResponse, TodoApiError> {
  return useQuery<TodoListResponse, TodoApiError>({
    queryKey: getTodoListQueryKey(params),
    queryFn: () => fetchTodoList(params),
    // An empty page past the end is about to redirect, so it must not stand in for the next page.
    placeholderData: (previous) =>
      previous && previous.items.length === 0 && previous.totalItems > 0 ? undefined : previous,
    staleTime: 30_000,
  });
}
