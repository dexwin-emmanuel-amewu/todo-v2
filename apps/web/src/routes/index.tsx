import { getRouteApi } from "@tanstack/react-router";
import { useRef } from "react";

import { TodoFilters } from "../components/TodoFilters";
import { TodoList } from "../components/TodoList";
import { TodoSearch } from "../components/TodoSearch";
import { CreateTodoForm } from "../components/CreateTodoForm";
import { usePatchTodoCompletionMutation } from "../hooks/usePatchTodoCompletionMutation";
import { useDeleteTodoMutation } from "../hooks/useDeleteTodoMutation";
import { useReplaceTodoMutation } from "../hooks/useReplaceTodoMutation";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { getTodoStatusFilter } from "../module/todo.filter";
import { getTodoListSearchLink } from "../module/todo.search";
import { getTodoListViewState } from "../module/todo.state";

const homeRoute = getRouteApi("/");

export function HomePage() {
  const urlSearch = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filter = getTodoStatusFilter(urlSearch);
  const search = urlSearch.search;
  const query = useTodoListQuery({ status: filter, search });

  const commitSearch = (next: string | undefined) =>
    void navigate({
      to: "/",
      search: getTodoListSearchLink({ status: filter, search: next }),
      replace: true,
    });
  const completionMutation = usePatchTodoCompletionMutation();
  const replacementMutation = useReplaceTodoMutation();
  const deletionMutation = useDeleteTodoMutation();

  const state = getTodoListViewState({
    status: query.status,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
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
      <TodoSearch value={search} onCommit={commitSearch} inputRef={searchInputRef} />
      <TodoFilters />
      <TodoList
        state={state}
        filter={filter}
        search={search}
        onClearSearch={() => {
          commitSearch(undefined);
          searchInputRef.current?.focus();
        }}
        totalItems={query.data?.totalItems}
        completion={completion}
        replacement={replacement}
        deletion={deletion}
      />
    </main>
  );
}
