import { TodoList } from "../components/TodoList";
import { CreateTodoForm } from "../components/CreateTodoForm";
import { usePatchTodoCompletionMutation } from "../hooks/usePatchTodoCompletionMutation";
import { useReplaceTodoMutation } from "../hooks/useReplaceTodoMutation";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { getTodoListViewState } from "../module/todo.state";

export function HomePage() {
  const query = useTodoListQuery();
  const completionMutation = usePatchTodoCompletionMutation();
  const replacementMutation = useReplaceTodoMutation();

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

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-semibold">Todo</h1>
      <CreateTodoForm />
      <TodoList state={state} completion={completion} replacement={replacement} />
    </main>
  );
}
