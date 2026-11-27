import type { Ref } from "react";

import {
  getClearCompletedErrorMessage,
  getClearCompletedLabel,
  getClearCompletedPendingMessage,
  getClearCompletedResultMessage,
} from "../module/todo.clearCompleted";

const buttonClassName =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const retryClassName =
  "mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export function TodoClearCompleted({
  completedCount,
  scoped,
  isPending,
  locked,
  deletedCount,
  error,
  onClear,
  onRetry,
  buttonRef,
}: {
  completedCount: number;
  scoped: boolean;
  isPending: boolean;
  locked: boolean;
  deletedCount: number | null;
  error: unknown;
  onClear: () => void;
  onRetry: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const visible = completedCount > 0;
  const unavailable = isPending || locked;

  return (
    <div className="mt-3 flex flex-col items-end">
      {visible && (
        <button
          ref={buttonRef}
          type="button"
          aria-disabled={unavailable}
          aria-describedby={scoped ? "clear-completed-scope" : undefined}
          onClick={() => {
            if (!unavailable) onClear();
          }}
          className={buttonClassName}
        >
          {getClearCompletedLabel(completedCount)}
        </button>
      )}
      {visible && scoped && (
        <p id="clear-completed-scope" className="mt-1 text-xs text-slate-500">
          Applies to all todos, not only this view.
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-1 text-xs text-slate-600">
        {isPending
          ? getClearCompletedPendingMessage()
          : deletedCount !== null
            ? getClearCompletedResultMessage(deletedCount)
            : ""}
      </p>
      {visible && !isPending && error != null && (
        <div
          role="alert"
          className="mt-2 w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{getClearCompletedErrorMessage(error)}</p>
          <button
            type="button"
            aria-disabled={locked}
            onClick={() => {
              if (!locked) onRetry();
            }}
            className={retryClassName}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
