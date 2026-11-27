import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setAllTodosCompleted, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useSetAllTodosCompletedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (completed: boolean) => setAllTodosCompleted(completed),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while updating all todos", error);
      }

      return queryClient.invalidateQueries({ queryKey: todoListQueryKey });
    },
  });
}
