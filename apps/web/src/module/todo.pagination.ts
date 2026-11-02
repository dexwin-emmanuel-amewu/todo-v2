import { todoPageQuerySchema, todoPageSizeQuerySchema } from "@todo/contracts";

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type NormalizedPagination = { ok: true; value: number | undefined } | { ok: false };

function readWholeNumber(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return NaN;
}

export function normalizePage(value: unknown): NormalizedPagination {
  if (value === undefined) return { ok: true, value: undefined };

  const parsed = todoPageQuerySchema.safeParse(readWholeNumber(value));

  if (!parsed.success || !Number.isSafeInteger(parsed.data)) return { ok: false };

  return { ok: true, value: parsed.data === 1 ? undefined : parsed.data };
}

export function normalizePageSize(value: unknown): NormalizedPagination {
  if (value === undefined) return { ok: true, value: undefined };

  const parsed = todoPageSizeQuerySchema.safeParse(readWholeNumber(value));

  if (!parsed.success || !PAGE_SIZES.some((size) => size === parsed.data)) return { ok: false };

  return { ok: true, value: parsed.data === DEFAULT_PAGE_SIZE ? undefined : parsed.data };
}

export function getPageRange({
  page,
  pageSize,
  itemCount,
}: {
  page: number;
  pageSize: number;
  itemCount: number;
}): { start: number; end: number } {
  const start = (page - 1) * pageSize + 1;

  return { start, end: start + itemCount - 1 };
}

export function getPageRedirect({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
}): number | undefined {
  const lastPage = Math.max(1, totalPages);

  return page > lastPage ? lastPage : undefined;
}
