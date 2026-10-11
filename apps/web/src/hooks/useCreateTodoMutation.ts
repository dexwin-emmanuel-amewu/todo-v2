import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTodo } from "../api/todo.api";
import { todoListQueryKey } from "./useTodoListQuery";

export function useCreateTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoListQueryKey }),
  });
}
