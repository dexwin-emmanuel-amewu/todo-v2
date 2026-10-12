import { replaceTodoSchema, type Todo } from "@todo/contracts";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
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

type ReplacementControls = {
  isPending: boolean;
  onSave: (todoId: string, title: string, completed: boolean) => Promise<unknown>;
};

const noCompletionControls: CompletionControls = {
  isPending: false,
  error: null,
  onToggle: () => {},
  onRetry: () => {},
};

const noReplacementControls: ReplacementControls = {
  isPending: false,
  onSave: async () => {},
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

function replacementErrorMessage(error: unknown): string {
  return match(error)
    .with(P.instanceOf(TodoApiError), ({ type, status }) =>
      match({ type, status })
        .with(
          { type: "request_validation" },
          () => "The title could not be saved. Check the title and try again.",
        )
        .with({ type: "network" }, () => "Could not reach the server. Your draft is still here.")
        .with(
          { type: "http", status: 404 },
          () => "This todo may have been removed. Refresh the list.",
        )
        .with({ type: "http" }, () => "The server could not save this todo. Try again.")
        .with(
          { type: "response_validation" },
          () => "The server returned an unexpected response. Try again.",
        )
        .exhaustive(),
    )
    .otherwise(() => "Something went wrong. Your draft is still here. Try again.");
}

function TodoListItem({
  todo,
  controls,
  replacement,
  isEditing,
  anotherRowIsEditing,
  onStartEdit,
  onCancelEdit,
  registerEditButton,
}: {
  todo: Todo;
  controls: CompletionControls;
  replacement: ReplacementControls;
  isEditing: boolean;
  anotherRowIsEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  registerEditButton: (todoId: string, button: HTMLButtonElement | null) => void;
}) {
  const [draft, setDraft] = useState(todo.title);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPending = replacement.isPending && isEditing;
  const controlsAreDisabled = controls.isPending || replacement.isPending || anotherRowIsEditing;
  const hasError = controls.error != null && controls.errorTodoId === todo.id;

  useLayoutEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && requestError != null && !replacement.isPending) {
      inputRef.current?.focus();
    }
  }, [isEditing, replacement.isPending, requestError]);

  function beginEditing() {
    if (controlsAreDisabled) return;
    setDraft(todo.title);
    setValidationMessage(null);
    setRequestError(null);
    onStartEdit();
  }

  function cancelEditing() {
    setDraft(todo.title);
    setValidationMessage(null);
    setRequestError(null);
    onCancelEdit();
  }

  async function saveDraft(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (replacement.isPending) return;

    const parsed = replaceTodoSchema.safeParse({ title: draft, completed: todo.completed });
    if (!parsed.success) {
      const normalizedTitle = draft.trim();
      setValidationMessage(
        normalizedTitle.length === 0
          ? "Enter a todo title."
          : normalizedTitle.length < 6
            ? "Use at least 6 characters."
            : "Keep the title to 100 characters or fewer.",
      );
      inputRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    setRequestError(null);
    try {
      await replacement.onSave(todo.id, parsed.data.title, parsed.data.completed);
      onCancelEdit();
    } catch (error) {
      setRequestError(error);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {isEditing ? (
        <form
          onSubmit={saveDraft}
          onKeyDown={handleKeyDown}
          className="flex w-full flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`todo-title-${todo.id}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Edit title for {todo.title}
            </label>
            <input
              ref={inputRef}
              id={`todo-title-${todo.id}`}
              type="text"
              value={draft}
              maxLength={100}
              disabled={isPending}
              aria-invalid={validationMessage ? true : undefined}
              aria-describedby={validationMessage ? `todo-title-error-${todo.id}` : undefined}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
                setValidationMessage(null);
                setRequestError(null);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:bg-slate-100"
            />
            {validationMessage && (
              <p id={`todo-title-error-${todo.id}`} className="mt-1 text-sm text-red-700">
                {validationMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {todo.completed ? "Completed" : "Active"}
            </span>
            <button type="submit" disabled={isPending} className={retryClassName}>
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={cancelEditing}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait"
            >
              Cancel
            </button>
          </div>
          {isPending && (
            <p role="status" aria-live="polite" className="w-full text-sm text-slate-600">
              Saving
            </p>
          )}
          {requestError != null && (
            <div
              role="alert"
              className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <p>{replacementErrorMessage(requestError)}</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void saveDraft()}
                className={retryClassName}
              >
                Retry save
              </button>
            </div>
          )}
        </form>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <input
              type="checkbox"
              checked={todo.completed}
              disabled={controlsAreDisabled}
              aria-label={`Mark ${todo.title} as ${todo.completed ? "active" : "completed"}`}
              onChange={() => controls.onToggle(todo.id, !todo.completed)}
              className="size-4 shrink-0 accent-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait"
            />
            <span
              onDoubleClick={beginEditing}
              title="Double-click to edit"
              className={`${todo.completed ? "text-sm text-slate-400 line-through" : "text-sm"} min-w-0 cursor-text`}
            >
              {todo.title}
            </span>
          </div>
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
            {controls.isPending && controls.pendingTodoId === todo.id && (
              <span role="status" aria-live="polite" className="text-xs text-slate-600">
                Updating…
              </span>
            )}
            <button
              ref={(button) => registerEditButton(todo.id, button)}
              type="button"
              disabled={controlsAreDisabled}
              aria-label={`Edit ${todo.title}`}
              onClick={beginEditing}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait"
            >
              Edit
            </button>
          </div>
        </>
      )}
      {hasError && (
        <div
          role="alert"
          className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{completionErrorMessage(controls.error)}</p>
          <button
            type="button"
            disabled={controlsAreDisabled}
            onClick={controls.onRetry}
            className={retryClassName}
          >
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
  replacement,
  editingTodoId,
  onStartEdit,
  onCancelEdit,
  registerEditButton,
}: {
  items: Todo[];
  busy: boolean;
  controls: CompletionControls;
  replacement: ReplacementControls;
  editingTodoId: string | null;
  onStartEdit: (todoId: string) => void;
  onCancelEdit: () => void;
  registerEditButton: (todoId: string, button: HTMLButtonElement | null) => void;
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
        <TodoListItem
          key={todo.id}
          todo={todo}
          controls={controls}
          replacement={replacement}
          isEditing={editingTodoId === todo.id}
          anotherRowIsEditing={editingTodoId !== null && editingTodoId !== todo.id}
          onStartEdit={() => onStartEdit(todo.id)}
          onCancelEdit={onCancelEdit}
          registerEditButton={registerEditButton}
        />
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
  replacement = noReplacementControls,
}: {
  state: TodoListViewState;
  completion?: CompletionControls;
  replacement?: ReplacementControls;
}) {
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const editButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousEditingTodoId = useRef<string | null>(null);
  const onStartEdit = (todoId: string) => setEditingTodoId(todoId);
  const onCancelEdit = () => setEditingTodoId(null);
  const registerEditButton = (todoId: string, button: HTMLButtonElement | null) => {
    if (button) editButtonRefs.current.set(todoId, button);
    else editButtonRefs.current.delete(todoId);
  };
  const busy = completion.isPending || replacement.isPending;

  useLayoutEffect(() => {
    const previousTodoId = previousEditingTodoId.current;
    if (previousTodoId && editingTodoId === null) {
      editButtonRefs.current.get(previousTodoId)?.focus();
    }
    previousEditingTodoId.current = editingTodoId;
  }, [editingTodoId]);

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
      <TodoItems
        items={items}
        busy={busy}
        controls={completion}
        replacement={replacement}
        editingTodoId={editingTodoId}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        registerEditButton={registerEditButton}
      />
    ))
    .with({ state: "refreshing" }, ({ items }) => (
      <div className="space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-500">
          Refreshing
        </p>
        <TodoItems
          items={items}
          busy={true}
          controls={completion}
          replacement={replacement}
          editingTodoId={editingTodoId}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          registerEditButton={registerEditButton}
        />
      </div>
    ))
    .with({ state: "refresh_failure" }, ({ items, retry }) => (
      <div className="space-y-3">
        <div role="alert" className={alertClassName}>
          <p>Could not refresh your todos. Showing the last list that loaded.</p>
          <RetryButton retry={retry} />
        </div>
        <TodoItems
          items={items}
          busy={busy}
          controls={completion}
          replacement={replacement}
          editingTodoId={editingTodoId}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          registerEditButton={registerEditButton}
        />
      </div>
    ))
    .exhaustive();
}
