import { Link, useSearch } from "@tanstack/react-router";

import { getTodoListSearch } from "../module/todo.filter";
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
  const { search } = getTodoListSearch(useSearch({ strict: false }));

  return (
    <nav aria-label="Filter todos" className="mb-3 flex gap-2">
      {filters.map(({ label, status }) => (
        <Link
          key={label}
          to="/"
          search={getTodoListSearchLink({ status, search })}
          activeOptions={{ exact: true }}
          className={linkClassName}
          activeProps={{ className: selectedClassName }}
          inactiveProps={{ className: unselectedClassName }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
