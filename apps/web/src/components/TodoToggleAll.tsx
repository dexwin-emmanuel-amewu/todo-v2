import type { Ref } from "react";

import {
  getToggleAllErrorMessage,
  getToggleAllLabel,
  getToggleAllPendingMessage,
  getToggleAllResultMessage,
} from "../module/todo.toggleAll";

const retryClassName =
  "mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export type ToggleAllResult = { updatedCount: number; completed: boolean };

export function TodoToggleAll({
  totalCount,
  checked,
  desired,
  scoped,
  isPending,
  pendingCompleted,
  locked,
  result,
  error,
  onToggle,
  onRetry,
  inputRef,
}: {
  totalCount: number;
  checked: boolean;
  desired: boolean;
  scoped: boolean;
  isPending: boolean;
  pendingCompleted?: boolean;
  locked: boolean;
  result: ToggleAllResult | null;
  error: unknown;
  onToggle: (completed: boolean) => void;
  onRetry: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const unavailable = isPending || locked;
  const label = getToggleAllLabel({ totalCount, desired });

  return (
    <div className="mb-3">
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          aria-disabled={unavailable}
          aria-describedby={scoped ? "toggle-all-scope" : undefined}
          onChange={() => {
            if (!unavailable) onToggle(desired);
          }}
          className="size-4 shrink-0 accent-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        />
        {label}
      </label>
      {scoped && (
        <p id="toggle-all-scope" className="mt-1 ml-7 text-xs text-slate-500">
          Applies to all todos, not only this view.
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-1 ml-7 text-xs text-slate-600">
        {isPending && pendingCompleted !== undefined
          ? getToggleAllPendingMessage(pendingCompleted)
          : result
            ? getToggleAllResultMessage(result)
            : ""}
      </p>
      {!isPending && error != null && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{getToggleAllErrorMessage(error)}</p>
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
