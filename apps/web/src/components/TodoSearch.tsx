import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { normalizeSearch } from "../module/todo.search";

export const SEARCH_DEBOUNCE_MS = 300;

const tooLongMessage = "Search must be 100 characters or fewer.";

export function TodoSearch({
  value,
  onCommit,
  inputRef,
}: {
  value: string | undefined;
  onCommit: (search: string | undefined) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownInputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = inputRef ?? ownInputRef;
  const committed = useRef(value);
  const onCommitRef = useRef(onCommit);
  const validation = normalizeSearch(draft);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  function stopTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  // The URL is the source of truth, so back and forward restore the box text.
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (!validation.ok || validation.value !== value) setDraft(value ?? "");
  }

  useEffect(() => {
    committed.current = value;
    stopTimer();
  }, [value]);

  useEffect(() => stopTimer, []);

  function commit(search: string | undefined) {
    stopTimer();
    if (search === committed.current) return;
    committed.current = search;
    onCommitRef.current(search);
  }

  function onChange(text: string) {
    setDraft(text);
    stopTimer();
    const result = normalizeSearch(text);
    if (!result.ok) return;
    timer.current = setTimeout(() => commit(result.value), SEARCH_DEBOUNCE_MS);
  }

  function clear() {
    setDraft("");
    commit(undefined);
    boxRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && draft !== "") {
      event.preventDefault();
      clear();
    }
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (validation.ok) commit(validation.value);
      }}
      className="mb-3"
    >
      <label htmlFor="todo-search" className="mb-1 block text-sm font-medium text-slate-700">
        Search todos
      </label>
      <div className="flex gap-2">
        <input
          ref={boxRef}
          id="todo-search"
          type="search"
          value={draft}
          autoComplete="off"
          aria-invalid={!validation.ok}
          aria-describedby={validation.ok ? undefined : "todo-search-error"}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search titles"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        />
        {draft !== "" && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Clear
          </button>
        )}
      </div>
      {!validation.ok && (
        <p id="todo-search-error" role="status" className="mt-1 text-sm text-red-700">
          {tooLongMessage}
        </p>
      )}
    </form>
  );
}
