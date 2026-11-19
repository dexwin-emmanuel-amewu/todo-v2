import type { DeleteSelectedTodosInput, UpdateSelectedTodosInput } from "@todo/contracts";
import type { Ref } from "react";

import {
  getBatchErrorMessage,
  getBatchPendingMessage,
  getBatchResultMessage,
  getBatchRetryIds,
} from "../module/todo.batchCompletion";
import {
  getBatchDeleteErrorMessage,
  getBatchDeleteLabel,
  getBatchDeletePendingMessage,
  getBatchDeleteResultMessage,
} from "../module/todo.batchDelete";
import {
  getSelectedCountLabel,
  getSelectionNoticeMessage,
  type SelectionNotice,
  type SelectPageState,
} from "../module/todo.selection";

const buttonClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const doneClassName =
  "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const deleteClassName =
  "rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const retryClassName =
  "mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export type BatchResult = { updatedCount: number; completed: boolean };

export function TodoSelectButton({
  locked,
  onEnter,
  buttonRef,
}: {
  locked: boolean;
  onEnter: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="mb-3 flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-disabled={locked}
        onClick={() => {
          if (!locked) onEnter();
        }}
        className={buttonClassName}
      >
        Select todos
      </button>
    </div>
  );
}

export function TodoSelectionBar({
  selectedCount,
  pageState,
  notice,
  onSelectPage,
  onUnselectPage,
  onClear,
  onDone,
  pageButtonRef,
  isPending,
  input,
  result,
  error,
  onMarkSelected,
  onRetry,
  deleteInput,
  deleteResult,
  deleteError,
  onDeleteSelected,
  onRetryDelete,
}: {
  selectedCount: number;
  pageState: SelectPageState;
  notice: SelectionNotice;
  onSelectPage: () => void;
  onUnselectPage: () => void;
  onClear: () => void;
  onDone: () => void;
  pageButtonRef?: Ref<HTMLButtonElement>;
  isPending: boolean;
  input?: UpdateSelectedTodosInput;
  result: BatchResult | null;
  error: unknown;
  onMarkSelected: (completed: boolean) => void;
  onRetry: () => void;
  deleteInput?: DeleteSelectedTodosInput;
  deleteResult: number | null;
  deleteError: unknown;
  onDeleteSelected: () => void;
  onRetryDelete: () => void;
}) {
  const pageUnavailable = isPending || pageState === "none";
  const clearUnavailable = isPending || selectedCount === 0;
  const markUnavailable = isPending || selectedCount === 0;
  const retryIds = input ? getBatchRetryIds(error, input.ids) : [];
  const deleteRetryIds = deleteInput ? getBatchRetryIds(deleteError, deleteInput.ids) : [];

  return (
    <div
      role="group"
      aria-label="Selection"
      className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p role="status" aria-live="polite" className="mr-auto text-sm font-medium text-slate-700">
          {getSelectedCountLabel(selectedCount)}
        </p>
        <button
          ref={pageButtonRef}
          type="button"
          aria-disabled={pageUnavailable}
          onClick={() => {
            if (pageUnavailable) return;
            if (pageState === "unselect") onUnselectPage();
            else onSelectPage();
          }}
          className={buttonClassName}
        >
          {pageState === "unselect" ? "Unselect this page" : "Select this page"}
        </button>
        <button
          type="button"
          aria-disabled={clearUnavailable}
          onClick={() => {
            if (!clearUnavailable) onClear();
          }}
          className={buttonClassName}
        >
          Clear selection
        </button>
        <button
          type="button"
          aria-disabled={isPending}
          onClick={() => {
            if (!isPending) onDone();
          }}
          className={doneClassName}
        >
          Done
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[true, false].map((completed) => (
          <button
            key={String(completed)}
            type="button"
            aria-disabled={markUnavailable}
            onClick={() => {
              if (!markUnavailable) onMarkSelected(completed);
            }}
            className={buttonClassName}
          >
            {completed ? "Mark selected as completed" : "Mark selected as active"}
          </button>
        ))}
        <button
          type="button"
          aria-disabled={markUnavailable}
          aria-describedby="delete-selected-note"
          onClick={() => {
            if (!markUnavailable) onDeleteSelected();
          }}
          className={deleteClassName}
        >
          {getBatchDeleteLabel(selectedCount)}
        </button>
      </div>
      <p id="delete-selected-note" className="mt-1 text-xs text-slate-500">
        Deleted todos cannot be restored.
      </p>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-slate-600">
        {isPending && deleteInput
          ? getBatchDeletePendingMessage(deleteInput.ids.length)
          : isPending && input
            ? getBatchPendingMessage({ count: input.ids.length, completed: input.completed })
            : deleteResult !== null
              ? getBatchDeleteResultMessage(deleteResult)
              : result
                ? getBatchResultMessage(result)
                : ""}
      </p>
      {!isPending && error != null && input && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{getBatchErrorMessage(error, input.ids)}</p>
          {retryIds.length > 0 && (
            <button type="button" onClick={onRetry} className={retryClassName}>
              Retry
            </button>
          )}
        </div>
      )}
      {!isPending && deleteError != null && deleteInput && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{getBatchDeleteErrorMessage(deleteError, deleteInput.ids)}</p>
          {deleteRetryIds.length > 0 && (
            <button type="button" onClick={onRetryDelete} className={retryClassName}>
              Retry
            </button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-1 text-xs text-slate-600">
        {getSelectionNoticeMessage(notice) ?? ""}
      </p>
    </div>
  );
}
