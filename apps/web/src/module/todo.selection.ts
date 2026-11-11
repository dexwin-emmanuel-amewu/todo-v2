import type { TodoStatusFilter } from "@todo/contracts";
import { match } from "ts-pattern";

export const SELECTION_LIMIT = 100;

export type SelectionScope = { status: TodoStatusFilter; search: string | undefined };

export type SelectionNotice = "limit" | "scope_changed" | null;

export type SelectionState =
  | { mode: "off" }
  | {
      mode: "on";
      scope: SelectionScope;
      selectedIds: ReadonlySet<string>;
      notice: SelectionNotice;
    };

export type SelectionAction =
  | { type: "enter"; scope: SelectionScope }
  | { type: "exit" }
  | { type: "toggle_row"; id: string }
  | { type: "select_page"; ids: readonly string[] }
  | { type: "unselect_page"; ids: readonly string[] }
  | { type: "clear" }
  | { type: "scope_changed"; scope: SelectionScope }
  | { type: "list_emptied" };

export type SelectPageState = "none" | "select" | "unselect";

export const initialSelectionState: SelectionState = { mode: "off" };

function sameScope(a: SelectionScope, b: SelectionScope): boolean {
  return a.status === b.status && a.search === b.search;
}

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  if (state.mode === "off") {
    return action.type === "enter"
      ? { mode: "on", scope: action.scope, selectedIds: new Set(), notice: null }
      : state;
  }

  return match(action)
    .with({ type: "enter" }, () => state)
    .with({ type: "exit" }, { type: "list_emptied" }, () => initialSelectionState)
    .with({ type: "toggle_row" }, ({ id }) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size > SELECTION_LIMIT) return { ...state, notice: "limit" as const };
      return { ...state, selectedIds: next, notice: null };
    })
    .with({ type: "select_page" }, ({ ids }) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) next.add(id);
      if (next.size > SELECTION_LIMIT) return { ...state, notice: "limit" as const };
      return { ...state, selectedIds: next, notice: null };
    })
    .with({ type: "unselect_page" }, ({ ids }) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) next.delete(id);
      return { ...state, selectedIds: next, notice: null };
    })
    .with({ type: "clear" }, () => ({ ...state, selectedIds: new Set<string>(), notice: null }))
    .with({ type: "scope_changed" }, ({ scope }) =>
      sameScope(state.scope, scope)
        ? state
        : { ...state, scope, selectedIds: new Set<string>(), notice: "scope_changed" as const },
    )
    .exhaustive();
}

export function getSelectPageState(
  visibleIds: readonly string[],
  selectedIds: ReadonlySet<string>,
): SelectPageState {
  if (visibleIds.length === 0) return "none";
  return visibleIds.every((id) => selectedIds.has(id)) ? "unselect" : "select";
}

export function getSelectedCountLabel(count: number): string {
  return `${count} selected`;
}

export function getSelectionNoticeMessage(notice: SelectionNotice): string | null {
  return match(notice)
    .with(
      "limit",
      () => `You can select up to ${SELECTION_LIMIT} todos. Unselect some to add more.`,
    )
    .with("scope_changed", () => "Selection cleared because the view changed.")
    .with(null, () => null)
    .exhaustive();
}
