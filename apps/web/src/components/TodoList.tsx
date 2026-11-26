import { replaceTodoSchema, type Todo } from "@todo/contracts";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
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

type DeletionControls = {
  isPending: boolean;
  pendingTodoId?: string;
  error: unknown;
  errorTodoId?: string;
  onDelete: (todoId: string) => Promise<unknown>;
};

const noDeletionControls: DeletionControls = {
  isPending: false,
  error: null,
  onDelete: async () => {},
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

function deletionErrorMessage(error: unknown): string {
  return match(error)
    .with(P.instanceOf(TodoApiError), ({ type, status }) =>
      match({ type, status })
        .with(
          { type: "request_validation" },
          () => "This todo could not be deleted. Refresh and try again.",
        )
        .with({ type: "network" }, () => "Could not reach the server. The todo was not deleted.")
        .with(
          { type: "http", status: 404 },
          () => "This todo no longer exists on the server. Refresh the list.",
        )
        .with({ type: "http" }, () => "The server could not delete this todo. Try again.")
        .with(
          { type: "response_validation" },
          () => "The server returned an unexpected response. Try again.",
        )
        .exhaustive(),
    )
    .otherwise(() => "Something went wrong. The todo was not deleted. Try again.");
}

function TodoListItem({
  todo,
  controls,
  replacement,
  deletion,
  isEditing,
  anotherRowIsEditing,
  onStartEdit,
  onCancelEdit,
  onDelete,
  registerEditButton,
  registerDeleteButton,
}: {
  todo: Todo;
  controls: CompletionControls;
  replacement: ReplacementControls;
  deletion: DeletionControls;
  isEditing: boolean;
  anotherRowIsEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (todo: Todo) => void;
  registerEditButton: (todoId: string, button: HTMLButtonElement | null) => void;
  registerDeleteButton: (todoId: string, button: HTMLButtonElement | null) => void;
}) {
  const [draft, setDraft] = useState(todo.title);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPending = replacement.isPending && isEditing;
  const controlsAreDisabled =
    controls.isPending || replacement.isPending || deletion.isPending || anotherRowIsEditing;
  const hasError = controls.error != null && controls.errorTodoId === todo.id;
  const hasDeletionError = deletion.error != null && deletion.errorTodoId === todo.id;
  const isDeleting = deletion.isPending && deletion.pendingTodoId === todo.id;

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
            {isDeleting && (
              <span role="status" aria-live="polite" className="text-xs text-slate-600">
                Deleting {todo.title}
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
            <button
              ref={(button) => registerDeleteButton(todo.id, button)}
              type="button"
              disabled={controlsAreDisabled}
              aria-label={`Delete ${todo.title}`}
              onClick={() => onDelete(todo)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isDeleting ? "Deleting…" : "Delete"}
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
      {hasDeletionError && (
        <div
          role="alert"
          className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{deletionErrorMessage(deletion.error)}</p>
          <button
            type="button"
            disabled={controlsAreDisabled}
            onClick={() => onDelete(todo)}
            className={retryClassName}
          >
            Retry delete
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
  deletion,
  editingTodoId,
  onStartEdit,
  onCancelEdit,
  onDelete,
  registerEditButton,
  registerDeleteButton,
  emptyHeadingRef,
}: {
  items: Todo[];
  busy: boolean;
  controls: CompletionControls;
  replacement: ReplacementControls;
  deletion: DeletionControls;
  editingTodoId: string | null;
  onStartEdit: (todoId: string) => void;
  onCancelEdit: () => void;
  onDelete: (todo: Todo) => void;
  registerEditButton: (todoId: string, button: HTMLButtonElement | null) => void;
  registerDeleteButton: (todoId: string, button: HTMLButtonElement | null) => void;
  emptyHeadingRef: RefObject<HTMLHeadingElement | null>;
}) {
  if (items.length === 0) {
    return (
      <div className={cardClassName}>
        <h2 ref={emptyHeadingRef} tabIndex={-1} className={`${messageClassName} outline-none`}>
          No todos yet.
        </h2>
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
          deletion={deletion}
          isEditing={editingTodoId === todo.id}
          anotherRowIsEditing={editingTodoId !== null && editingTodoId !== todo.id}
          onStartEdit={() => onStartEdit(todo.id)}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          registerEditButton={registerEditButton}
          registerDeleteButton={registerDeleteButton}
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
  deletion = noDeletionControls,
}: {
  state: TodoListViewState;
  completion?: CompletionControls;
  replacement?: ReplacementControls;
  deletion?: DeletionControls;
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
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const deletionInFlight = useRef(false);
  const pendingDeletionFocus = useRef<{ todoId: string; nextId?: string; prevId?: string } | null>(
    null,
  );
  const items = "items" in state ? state.items : null;
  const registerDeleteButton = (todoId: string, button: HTMLButtonElement | null) => {
    if (button) deleteButtonRefs.current.set(todoId, button);
    else deleteButtonRefs.current.delete(todoId);
  };
  const busy = completion.isPending || replacement.isPending || deletion.isPending;
  const activeEditingId = items?.some((item) => item.id === editingTodoId) ? editingTodoId : null;

  async function onDelete(todo: Todo) {
    if (deletionInFlight.current || deletion.isPending || !items) return;
    const index = items.findIndex((item) => item.id === todo.id);
    deletionInFlight.current = true;
    pendingDeletionFocus.current = {
      todoId: todo.id,
      nextId: items[index + 1]?.id,
      prevId: items[index - 1]?.id,
    };
    try {
      await deletion.onDelete(todo.id);
    } catch (error) {
      // A 404 refreshes the list, which can still remove the row and need focus.
      if (!(error instanceof TodoApiError && error.type === "http" && error.status === 404)) {
        pendingDeletionFocus.current = null;
      }
    } finally {
      deletionInFlight.current = false;
    }
  }

  useLayoutEffect(() => {
    const pending = pendingDeletionFocus.current;
    if (!pending || !items || items.some((item) => item.id === pending.todoId)) return;
    pendingDeletionFocus.current = null;

    const active = document.activeElement;
    if (active && active !== document.body) return;

    const target = [pending.nextId, pending.prevId]
      .map((id) => (id ? deleteButtonRefs.current.get(id) : undefined))
      .find((button) => button !== undefined);
    if (target) target.focus();
    else if (items.length === 0) emptyHeadingRef.current?.focus();
  }, [items]);

  useLayoutEffect(() => {
    const previousTodoId = previousEditingTodoId.current;
    if (previousTodoId && activeEditingId === null) {
      editButtonRefs.current.get(previousTodoId)?.focus();
    }
    previousEditingTodoId.current = activeEditingId;
  }, [activeEditingId]);

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
    .with({ state: P.union("ready", "refreshing", "refresh_failure") }, (listState) => (
      <div className="space-y-3">
        {listState.state === "refreshing" && (
          <p role="status" aria-live="polite" className="text-sm text-slate-500">
            Refreshing
          </p>
        )}
        {listState.state === "refresh_failure" && (
          <div role="alert" className={alertClassName}>
            <p>Could not refresh your todos. Showing the last list that loaded.</p>
            <RetryButton retry={listState.retry} />
          </div>
        )}
        <TodoItems
          items={listState.items}
          busy={listState.state === "refreshing" || busy}
          controls={completion}
          replacement={replacement}
          deletion={deletion}
          editingTodoId={activeEditingId}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          registerEditButton={registerEditButton}
          registerDeleteButton={registerDeleteButton}
          emptyHeadingRef={emptyHeadingRef}
        />
      </div>
    ))
    .exhaustive();
}
