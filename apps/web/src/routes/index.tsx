import { getRouteApi } from "@tanstack/react-router";

import { TodoFilters } from "../components/TodoFilters";
import { TodoList } from "../components/TodoList";
import { CreateTodoForm } from "../components/CreateTodoForm";
import { usePatchTodoCompletionMutation } from "../hooks/usePatchTodoCompletionMutation";
import { useDeleteTodoMutation } from "../hooks/useDeleteTodoMutation";
import { useReplaceTodoMutation } from "../hooks/useReplaceTodoMutation";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { getTodoStatusFilter } from "../module/todo.filter";
import { getTodoListViewState } from "../module/todo.state";

const homeRoute = getRouteApi("/");

export function HomePage() {
  const filter = getTodoStatusFilter(homeRoute.useSearch());
  const query = useTodoListQuery(filter);
  const completionMutation = usePatchTodoCompletionMutation();
  const replacementMutation = useReplaceTodoMutation();
  const deletionMutation = useDeleteTodoMutation();

  const state = getTodoListViewState({
    status: query.status,
    isFetching: query.isFetching,
    data: query.data,
    error: query.error,
    refetch: () => void query.refetch(),
  });

  const completion = {
    isPending: completionMutation.isPending,
    pendingTodoId: completionMutation.variables?.todoId,
    error: completionMutation.error,
    errorTodoId: completionMutation.variables?.todoId,
    onToggle: (todoId: string, completed: boolean) => {
      if (!completionMutation.isPending) completionMutation.mutate({ todoId, completed });
    },
    onRetry: () => {
      if (completionMutation.variables && !completionMutation.isPending) {
        completionMutation.mutate(completionMutation.variables);
      }
    },
  };

  const replacement = {
    isPending: replacementMutation.isPending,
    onSave: (todoId: string, title: string, completed: boolean) =>
      replacementMutation.mutateAsync({ todoId, title, completed }),
  };

  const deletion = {
    isPending: deletionMutation.isPending,
    pendingTodoId: deletionMutation.variables,
    error: deletionMutation.error,
    errorTodoId: deletionMutation.variables,
    onDelete: (todoId: string) => deletionMutation.mutateAsync(todoId),
  };

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-semibold">Todo</h1>
      <CreateTodoForm />
      <TodoFilters />
      <TodoList
        state={state}
        filter={filter}
        completion={completion}
        replacement={replacement}
        deletion={deletion}
      />
    </main>
  );
}
