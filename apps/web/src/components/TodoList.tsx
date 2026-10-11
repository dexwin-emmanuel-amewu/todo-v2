import type { Todo } from "@todo/contracts";
import { match, P } from "ts-pattern";
import { TodoApiError } from "../api/todo.api";
import type { TodoListViewState } from "../module/todo.state";

const cardClassName = "rounded-lg border border-slate-200 bg-white shadow-sm";
const messageClassName = "py-8 text-center text-sm text-slate-500";
const alertClassName = "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700";
const retryClassName =
  "mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

type CompletionControls = {
  isPending: boolean;
  pendingTodoId?: string;
  error: unknown;
  errorTodoId?: string;
  onToggle: (todoId: string, completed: boolean) => void;
  onRetry: () => void;
};

const noCompletionControls: CompletionControls = {
  isPending: false,
  error: null,
  onToggle: () => {},
  onRetry: () => {},
};

function completionErrorMessage(error: unknown): string {
  return match(error)
    .with(P.instanceOf(TodoApiError), ({ type, status }) =>
      match({ type, status })
        .with(
          { type: "request_validation" },
          () => "This todo could not be updated. Refresh and try again.",
        )
        .with({ type: "network" }, () => "Could not reach the server. Try again.")
        .with(
          { type: "http", status: 404 },
          () => "This todo may have been removed. Refresh the list.",
        )
        .with({ type: "http" }, () => "The server could not update this todo. Try again.")
        .with(
          { type: "response_validation" },
          () => "The server returned an unexpected response. Try again.",
        )
        .exhaustive(),
    )
    .otherwise(() => "Something went wrong. Try again.");
}

function TodoListItem({ todo, controls }: { todo: Todo; controls: CompletionControls }) {
  const isPending = controls.isPending && controls.pendingTodoId === todo.id;
  const hasError = controls.error != null && controls.errorTodoId === todo.id;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          disabled={controls.isPending}
          aria-label={`Mark ${todo.title} as ${todo.completed ? "active" : "completed"}`}
          onChange={() => controls.onToggle(todo.id, !todo.completed)}
          className="size-4 shrink-0 accent-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait"
        />
        <span
          className={
            todo.completed ? "min-w-0 text-sm text-slate-400 line-through" : "min-w-0 text-sm"
          }
        >
          {todo.title}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <span
          className={
            todo.completed
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
              : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          }
        >
          {todo.completed ? "Completed" : "Active"}
        </span>
        {isPending && (
          <span role="status" aria-live="polite" className="text-xs text-slate-600">
            Updating…
          </span>
        )}
      </div>
      {hasError && (
        <div
          role="alert"
          className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{completionErrorMessage(controls.error)}</p>
          <button type="button" onClick={controls.onRetry} className={retryClassName}>
            Retry update
          </button>
        </div>
      )}
    </li>
  );
}

function TodoItems({
  items,
  busy,
  controls,
}: {
  items: Todo[];
  busy: boolean;
  controls: CompletionControls;
}) {
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
        <TodoListItem key={todo.id} todo={todo} controls={controls} />
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

export function TodoList({
  state,
  completion = noCompletionControls,
}: {
  state: TodoListViewState;
  completion?: CompletionControls;
}) {
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
    .with({ state: "ready" }, ({ items }) => (
      <TodoItems items={items} busy={completion.isPending} controls={completion} />
    ))
    .with({ state: "refreshing" }, ({ items }) => (
      <div className="space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-500">
          Refreshing
        </p>
        <TodoItems items={items} busy={true} controls={completion} />
      </div>
    ))
    .with({ state: "refresh_failure" }, ({ items, retry }) => (
      <div className="space-y-3">
        <div role="alert" className={alertClassName}>
          <p>Could not refresh your todos. Showing the last list that loaded.</p>
          <RetryButton retry={retry} />
        </div>
        <TodoItems items={items} busy={completion.isPending} controls={completion} />
      </div>
    ))
    .exhaustive();
}
