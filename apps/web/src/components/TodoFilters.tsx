import { Link, useSearch } from "@tanstack/react-router";

import { getTodoListSearch, getTodoStatusFilter } from "../module/todo.filter";
import { getTodoListSearchLink } from "../module/todo.search";

const filters = [
  { label: "All", status: "all" },
  { label: "Active", status: "active" },
  { label: "Completed", status: "completed" },
] as const;

const linkClassName =
  "inline-block rounded-md border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";
const selectedClassName = "border-slate-900 bg-slate-900 font-semibold text-white";
const unselectedClassName = "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

export function TodoFilters() {
  const urlSearch = getTodoListSearch(useSearch({ strict: false }));
  const { search, pageSize } = urlSearch;
  const currentStatus = getTodoStatusFilter(urlSearch);

  return (
    <nav aria-label="Filter todos" className="mb-3 flex gap-2">
      {filters.map(({ label, status }) => {
        // Link's own active check compares the whole search, so it misses pages above 1.
        const selected = status === currentStatus;
        return (
          <Link
            key={label}
            to="/"
            search={getTodoListSearchLink({ status, search, pageSize })}
            activeOptions={{ exact: true }}
            activeProps={{}}
            aria-current={selected ? "page" : undefined}
            className={`${linkClassName} ${selected ? selectedClassName : unselectedClassName}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
