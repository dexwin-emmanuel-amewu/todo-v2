import { type TodoStatusFilter, todoStatusFilterSchema } from "@todo/contracts";

import { normalizeSearch, type TodoListSearch } from "./todo.search";

export type { TodoListSearch };

// The router parses URL values as JSON, so `?search=123` arrives as a number.
function readSearchText(value: unknown): unknown {
  return typeof value === "number" || typeof value === "boolean" ? String(value) : value;
}

export function getTodoListSearch(search: Record<string, unknown>): TodoListSearch {
  const parsedStatus = todoStatusFilterSchema.safeParse(search.status);
  const parsedSearch = normalizeSearch(readSearchText(search.search));

  return {
    status: parsedStatus.success && parsedStatus.data !== "all" ? parsedStatus.data : undefined,
    search: parsedSearch.ok ? parsedSearch.value : undefined,
  };
}

export function getTodoStatusFilter(search: TodoListSearch): TodoStatusFilter {
  return search.status ?? "all";
}
