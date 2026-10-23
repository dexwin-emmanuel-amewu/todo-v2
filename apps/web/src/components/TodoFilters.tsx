import { Link } from "@tanstack/react-router";

import type { TodoListSearch } from "../module/todo.filter";

const filters: { label: string; search: TodoListSearch }[] = [
  { label: "All", search: {} },
  { label: "Active", search: { status: "active" } },
  { label: "Completed", search: { status: "completed" } },
];

const linkClassName =
  "inline-block rounded-md border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";
const selectedClassName = "border-slate-900 bg-slate-900 font-semibold text-white";
const unselectedClassName = "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

export function TodoFilters() {
  return (
    <nav aria-label="Filter todos" className="mb-3 flex gap-2">
      {filters.map(({ label, search }) => (
        <Link
          key={label}
          to="/"
          search={search}
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
