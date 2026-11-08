import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { TodoFilters } from "../components/TodoFilters";
import { TodoList } from "../components/TodoList";
import { TodoPagination } from "../components/TodoPagination";
import { TodoSearch } from "../components/TodoSearch";
import { TodoToggleAll } from "../components/TodoToggleAll";
import { CreateTodoForm } from "../components/CreateTodoForm";
import { usePatchTodoCompletionMutation } from "../hooks/usePatchTodoCompletionMutation";
import { useDeleteTodoMutation } from "../hooks/useDeleteTodoMutation";
import { useReplaceTodoMutation } from "../hooks/useReplaceTodoMutation";
import { useSetAllTodosCompletedMutation } from "../hooks/useSetAllTodosCompletedMutation";
import { useTodoListQuery } from "../hooks/useTodoListQuery";
import { useTodoSummaryQuery } from "../hooks/useTodoSummaryQuery";
import { getTodoStatusFilter } from "../module/todo.filter";
import { DEFAULT_PAGE_SIZE, getPageRedirect } from "../module/todo.pagination";
import { getTodoListPageLink, getTodoListSearchLink } from "../module/todo.search";
import { getTodoListViewState, type TodoListViewState } from "../module/todo.state";
import { getToggleAllState } from "../module/todo.toggleAll";

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
  const summaryQuery = useTodoSummaryQuery();

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
  const toggleAllMutation = useSetAllTodosCompletedMutation();

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

  const rowMutationPending =
    completionMutation.isPending || replacementMutation.isPending || deletionMutation.isPending;
  const toggleAll = summaryQuery.data ? getToggleAllState(summaryQuery.data) : undefined;
  const toggleAllResult =
    toggleAllMutation.isSuccess && toggleAllMutation.variables !== undefined
      ? {
          updatedCount: toggleAllMutation.data.updatedCount,
          completed: toggleAllMutation.variables,
        }
      : null;

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-semibold">Todo</h1>
      <CreateTodoForm />
      <TodoSearch value={search} onCommit={commitSearch} inputRef={searchInputRef} />
      <TodoFilters />
      {summaryQuery.isSuccess && toggleAll?.state === "visible" && (
        <TodoToggleAll
          totalCount={toggleAll.totalCount}
          checked={toggleAll.checked}
          desired={toggleAll.desired}
          scoped={filter !== "all" || Boolean(search)}
          isPending={toggleAllMutation.isPending}
          pendingCompleted={toggleAllMutation.variables}
          locked={rowMutationPending}
          result={toggleAllResult}
          error={toggleAllMutation.error}
          onToggle={(completed) => {
            if (!toggleAllMutation.isPending && !rowMutationPending) {
              toggleAllMutation.mutate(completed);
            }
          }}
          onRetry={() => {
            const completed = toggleAllMutation.variables;
            if (completed !== undefined && !toggleAllMutation.isPending && !rowMutationPending) {
              toggleAllMutation.mutate(completed);
            }
          }}
        />
      )}
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
        bulkPending={toggleAllMutation.isPending}
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
