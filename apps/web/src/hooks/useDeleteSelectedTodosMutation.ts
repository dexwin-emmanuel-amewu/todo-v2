import type { DeleteSelectedTodosInput } from "@todo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSelectedTodos, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useDeleteSelectedTodosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteSelectedTodosInput) => deleteSelectedTodos(input),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while deleting the selected todos", error);
      }

      return queryClient.invalidateQueries({ queryKey: todoListQueryKey });
    },
  });
}
