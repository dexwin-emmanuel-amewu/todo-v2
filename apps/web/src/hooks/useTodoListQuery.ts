import { type TodoListResponse } from "@todo/contracts";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
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
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
