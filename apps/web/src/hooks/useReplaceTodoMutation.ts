import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replaceTodo, TodoApiError } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export type ReplaceTodoInput = {
  todoId: string;
  title: string;
  completed: boolean;
};

export function useReplaceTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ todoId, title, completed }: ReplaceTodoInput) =>
      replaceTodo(todoId, title, completed),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
    onError: (error) => {
      if (!(error instanceof TodoApiError)) {
        console.error("Unexpected error while editing a todo", error);
      }

      if (error instanceof TodoApiError && error.type === "http" && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: todoListQueryKey });
      }
    },
  });
}
