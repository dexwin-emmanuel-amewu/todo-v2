import type { Ref } from "react";

import {
  getSelectedCountLabel,
  getSelectionNoticeMessage,
  type SelectionNotice,
  type SelectPageState,
} from "../module/todo.selection";

const buttonClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const doneClassName =
  "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

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
}: {
  selectedCount: number;
  pageState: SelectPageState;
  notice: SelectionNotice;
  onSelectPage: () => void;
  onUnselectPage: () => void;
  onClear: () => void;
  onDone: () => void;
  pageButtonRef?: Ref<HTMLButtonElement>;
}) {
  const pageUnavailable = pageState === "none";
  const clearUnavailable = selectedCount === 0;

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
        <button type="button" onClick={onDone} className={doneClassName}>
          Done
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-slate-600">
        {getSelectionNoticeMessage(notice) ?? ""}
      </p>
    </div>
  );
}
