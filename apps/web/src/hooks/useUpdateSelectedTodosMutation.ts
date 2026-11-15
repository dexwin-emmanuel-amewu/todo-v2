import type { UpdateSelectedTodosInput } from "@todo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { TodoApiError, updateSelectedTodos } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useUpdateSelectedTodosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSelectedTodosInput) => updateSelectedTodos(input),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while updating the selected todos", error);
      }

      return queryClient.invalidateQueries({ queryKey: todoListQueryKey });
    },
  });
}
