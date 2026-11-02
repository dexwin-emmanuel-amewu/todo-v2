import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { TodoFilters } from "../components/TodoFilters";
import { TodoList } from "../components/TodoList";
import { TodoPagination } from "../components/TodoPagination";
import { TodoSearch } from "../components/TodoSearch";
import { CreateTodoForm } from "../components/CreateTodoForm";
import { usePatchTodoCompletionMutation } from "../hooks/usePatchTodoCompletionMutation";
import { useDeleteTodoMutation } from "../hooks/useDeleteTodoMutation";
import { useReplaceTodoMutation } from "../hooks/useReplaceTodoMutation";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { getTodoStatusFilter } from "../module/todo.filter";
import { DEFAULT_PAGE_SIZE, getPageRedirect } from "../module/todo.pagination";
import { getTodoListPageLink, getTodoListSearchLink } from "../module/todo.search";
import { getTodoListViewState, type TodoListViewState } from "../module/todo.state";

const homeRoute = getRouteApi("/");

export function HomePage() {
  const urlSearch = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filter = getTodoStatusFilter(urlSearch);
  const search = urlSearch.search;
  const page = urlSearch.page ?? 1;
  const pageSize = urlSearch.pageSize ?? DEFAULT_PAGE_SIZE;
  const query = useTodoListQuery({ status: filter, search, page, pageSize });

  const commitSearch = (next: string | undefined) =>
    void navigate({
      to: "/",
      search: getTodoListSearchLink({
        status: filter,
        search: next,
        pageSize: urlSearch.pageSize,
      }),
      replace: true,
    });
  const goToPage = (nextPage: number) =>
    void navigate({
      to: "/",
      search: getTodoListPageLink({
        status: filter,
        search,
        pageSize: urlSearch.pageSize,
        page: nextPage,
      }),
    });
  const changePageSize = (nextSize: number) =>
    void navigate({
      to: "/",
      search: getTodoListSearchLink({
        status: filter,
        search,
        pageSize: nextSize === DEFAULT_PAGE_SIZE ? undefined : nextSize,
      }),
    });

  // A page past the end, or a page above 1 on an empty list, moves to the last valid page.
  const settled = query.isPlaceholderData ? undefined : query.data;
  const redirectPage = settled
    ? getPageRedirect({ page, totalPages: settled.totalPages, totalItems: settled.totalItems })
    : undefined;

  useEffect(() => {
    if (redirectPage === undefined) return;
    void navigate({
      to: "/",
      search: getTodoListPageLink({
        status: filter,
        search,
        pageSize: urlSearch.pageSize,
        page: redirectPage,
      }),
      replace: true,
    });
  }, [redirectPage, navigate, filter, search, urlSearch.pageSize]);
  const completionMutation = usePatchTodoCompletionMutation();
  const replacementMutation = useReplaceTodoMutation();
  const deletionMutation = useDeleteTodoMutation();

  const queryState = getTodoListViewState({
    status: query.status,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    data: query.data,
    error: query.error,
    refetch: () => void query.refetch(),
  });
  const state: TodoListViewState =
    redirectPage === undefined ? queryState : { state: "initial_loading" };
  const showPagination =
    query.data !== undefined &&
    redirectPage === undefined &&
    (queryState.state === "ready" ||
      queryState.state === "refreshing" ||
      queryState.state === "loading_query");

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
      {showPagination && query.data && (
        <TodoPagination
          page={page}
          pageSize={pageSize}
          totalItems={query.data.totalItems}
          totalPages={query.data.totalPages}
          itemCount={query.data.items.length}
          isLoading={queryState.state === "loading_query"}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      )}
    </main>
  );
}
