import { PAGE_SIZES, getPageRange } from "../module/todo.pagination";

const buttonClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-white";
const selectClassName =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

export function TodoPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  itemCount,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  itemCount: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (totalItems <= PAGE_SIZES[0]) return null;

  const canGoBack = !isLoading && page > 1;
  const canGoForward = !isLoading && page < totalPages;
  const { start, end } = getPageRange({ page, pageSize, itemCount });
  const pageLabel = `Page ${page} of ${totalPages}`;

  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-disabled={!canGoBack}
        onClick={() => {
          if (canGoBack) {
            onPageChange(page - 1);
          }
        }}
        className={buttonClassName}
      >
        Previous page
      </button>
      <button
        type="button"
        aria-disabled={!canGoForward}
        onClick={() => {
          if (canGoForward) {
            onPageChange(page + 1);
          }
        }}
        className={buttonClassName}
      >
        Next page
      </button>
      {isLoading ? null : (
        <p className="text-sm text-slate-600">
          {pageLabel}. Showing {start} to {end} of {totalItems}
        </p>
      )}
      <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
        Todos per page
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className={selectClassName}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <p role="status" aria-live="polite" className="sr-only">
        {isLoading ? "" : pageLabel}
      </p>
    </nav>
  );
}
