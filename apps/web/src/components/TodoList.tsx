import type { Todo } from "@todo/contracts";
import { match } from "ts-pattern";
import type { TodoListViewState } from "../module/todo.state";

const cardClassName = "rounded-lg border border-slate-200 bg-white shadow-sm";
const messageClassName = "py-8 text-center text-sm text-slate-500";
const alertClassName = "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700";
const retryClassName =
  "mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

function TodoListItem({ todo }: { todo: Todo }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className={todo.completed ? "text-sm text-slate-400 line-through" : "text-sm"}>
        {todo.title}
      </span>
      <span
        className={
          todo.completed
            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
        }
      >
        {todo.completed ? "Completed" : "Active"}
      </span>
    </li>
  );
}

function TodoItems({ items, busy }: { items: Todo[]; busy: boolean }) {
  if (items.length === 0) {
    return (
      <div className={cardClassName}>
        <p className={messageClassName}>No todos yet.</p>
      </div>
    );
  }

  return (
    <ul
      aria-busy={busy}
      className={`${cardClassName} divide-y divide-slate-200 ${busy ? "opacity-60" : ""}`}
    >
      {items.map((todo) => (
        <TodoListItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

function RetryButton({ retry }: { retry: () => void }) {
  return (
    <button type="button" onClick={retry} className={retryClassName}>
      Retry
    </button>
  );
}

export function TodoList({ state }: { state: TodoListViewState }) {
  return match(state)
    .with({ state: "initial_loading" }, () => (
      <div className={cardClassName}>
        <p role="status" aria-live="polite" className={messageClassName}>
          Loading todos
        </p>
      </div>
    ))
    .with({ state: "initial_failure" }, ({ retry }) => (
      <div role="alert" className={alertClassName}>
        <p>Could not load your todos.</p>
        <RetryButton retry={retry} />
      </div>
    ))
    .with({ state: "ready" }, ({ items }) => <TodoItems items={items} busy={false} />)
    .with({ state: "refreshing" }, ({ items }) => (
      <div className="space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-500">
          Refreshing
        </p>
        <TodoItems items={items} busy={true} />
      </div>
    ))
    .with({ state: "refresh_failure" }, ({ items, retry }) => (
      <div className="space-y-3">
        <div role="alert" className={alertClassName}>
          <p>Could not refresh your todos. Showing the last list that loaded.</p>
          <RetryButton retry={retry} />
        </div>
        <TodoItems items={items} busy={false} />
      </div>
    ))
    .exhaustive();
}
