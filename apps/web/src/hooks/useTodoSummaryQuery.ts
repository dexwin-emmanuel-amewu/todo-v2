import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchTodoSummary, type TodoApiError } from "../api/todo.api";
import type { TodoSummary } from "../module/todo.toggleAll";
import { todoListQueryKey } from "./useTodoListQuery";

export const todoSummaryQueryKey = [...todoListQueryKey, "summary"] as const;

export function useTodoSummaryQuery(): UseQueryResult<TodoSummary, TodoApiError> {
  return useQuery<TodoSummary, TodoApiError>({
    queryKey: todoSummaryQueryKey,
    queryFn: fetchTodoSummary,
    staleTime: 30_000,
  });
}
