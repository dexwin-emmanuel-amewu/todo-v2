import { type TodoStatusFilter, todoSearchQuerySchema } from "@todo/contracts";

export type TodoListSearch = {
  status?: Exclude<TodoStatusFilter, "all">;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type NormalizedSearch = { ok: true; value: string | undefined } | { ok: false };

export function normalizeSearch(text: unknown): NormalizedSearch {
  const parsed = todoSearchQuerySchema.safeParse(text);

  if (!parsed.success) return { ok: false };

  return { ok: true, value: parsed.data === "" ? undefined : parsed.data };
}

export function getTodoListSearchLink({
  status,
  search,
  pageSize,
}: {
  status?: TodoStatusFilter;
  search?: string;
  pageSize?: number;
}): TodoListSearch {
  return {
    ...(status && status !== "all" ? { status } : {}),
    ...(search ? { search } : {}),
    ...(pageSize ? { pageSize } : {}),
  };
}

export function getTodoListPageLink({
  page,
  ...rest
}: {
  status?: TodoStatusFilter;
  search?: string;
  pageSize?: number;
  page?: number;
}): TodoListSearch {
  return {
    ...getTodoListSearchLink(rest),
    ...(page && page > 1 ? { page } : {}),
  };
}
