import { TodoList } from "../components/TodoList";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { getTodoListViewState } from "../module/todo.state";

export function HomePage() {
  const query = useTodoListQuery();

  const state = getTodoListViewState({
    status: query.status,
    isFetching: query.isFetching,
    data: query.data,
    error: query.error,
    refetch: () => void query.refetch(),
  });

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-semibold">Todo</h1>
      <TodoList state={state} />
    </main>
  );
}
