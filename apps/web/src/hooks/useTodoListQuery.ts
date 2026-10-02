import { type TodoListResponse } from "@todo/contracts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchTodoList, type TodoApiError } from "../api/todo.api";

export const todoListQueryKey = ["todos", "list"] as const;

export function useTodoListQuery(): UseQueryResult<TodoListResponse, TodoApiError> {
  return useQuery<TodoListResponse, TodoApiError>({
    queryKey: todoListQueryKey,
    queryFn: fetchTodoList,
    staleTime: 30_000,
  });
}
