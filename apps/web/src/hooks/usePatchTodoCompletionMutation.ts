import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchTodoCompletion, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export type PatchTodoCompletionInput = { todoId: string; completed: boolean };

export function usePatchTodoCompletionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ todoId, completed }: PatchTodoCompletionInput) =>
      patchTodoCompletion(todoId, completed),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while updating a todo", error);
      }

      if (error instanceof TodoApiError && error.type === "http" && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: todoListQueryKey });
      }
    },
  });
}
