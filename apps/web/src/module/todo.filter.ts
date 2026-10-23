import { type TodoStatusFilter, todoStatusFilterSchema } from "@todo/contracts";

export type TodoListSearch = { status?: Exclude<TodoStatusFilter, "all"> };

export function getTodoListSearch(search: Record<string, unknown>): TodoListSearch {
  const parsed = todoStatusFilterSchema.safeParse(search.status);

  return { status: parsed.success && parsed.data !== "all" ? parsed.data : undefined };
}

export function getTodoStatusFilter(search: TodoListSearch): TodoStatusFilter {
  return search.status ?? "all";
}
