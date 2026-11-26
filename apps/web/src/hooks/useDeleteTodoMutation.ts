import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTodo, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useDeleteTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (todoId: string) => deleteTodo(todoId),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while deleting a todo", error);
      }

      if (error instanceof TodoApiError && error.type === "http" && error.status === 404) {
        return queryClient.invalidateQueries({ queryKey: todoListQueryKey });
      }
    },
  });
}
