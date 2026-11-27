import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clearCompletedTodos, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useClearCompletedTodosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearCompletedTodos(),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while clearing completed todos", error);
      }

      return queryClient.invalidateQueries({ queryKey: todoListQueryKey });
    },
  });
}
