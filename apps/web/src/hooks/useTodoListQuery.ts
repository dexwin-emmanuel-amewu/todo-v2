import { type TodoListResponse, type TodoStatusFilter } from "@todo/contracts";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchTodoList, type TodoApiError } from "../api/todo.api";

export const todoListQueryKey = ["todos", "list"] as const;

export function getTodoListQueryKey(status: TodoStatusFilter) {
  return [...todoListQueryKey, { status }] as const;
}

export function useTodoListQuery(
  status: TodoStatusFilter = "all",
): UseQueryResult<TodoListResponse, TodoApiError> {
  return useQuery<TodoListResponse, TodoApiError>({
    queryKey: getTodoListQueryKey(status),
    queryFn: () => fetchTodoList(status),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
