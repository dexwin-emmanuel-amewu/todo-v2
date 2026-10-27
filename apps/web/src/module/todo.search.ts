import { type TodoStatusFilter, todoSearchQuerySchema } from "@todo/contracts";

export type TodoListSearch = {
  status?: Exclude<TodoStatusFilter, "all">;
  search?: string;
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
}: {
  status?: TodoStatusFilter;
  search?: string;
}): TodoListSearch {
  return {
    ...(status && status !== "all" ? { status } : {}),
    ...(search ? { search } : {}),
  };
}
