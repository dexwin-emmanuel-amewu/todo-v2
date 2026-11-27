import { describe, expect, it } from "vitest";

import {
  getSelectedCountLabel,
  getSelectionNoticeMessage,
  getSelectPageState,
  initialSelectionState,
  SELECTION_LIMIT,
  selectionReducer,
  type SelectionScope,
  type SelectionState,
} from "./todo.selection";

const scope: SelectionScope = { status: "all", search: undefined };

function ids(count: number, prefix = "id"): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function selected(selectedIds: string[], notice: "limit" | "scope_changed" | null = null) {
  return {
    mode: "on",
    scope,
    selectedIds: new Set(selectedIds),
    notice,
  } satisfies SelectionState;
}

describe("selectionReducer", () => {
  it("starts off", () => {
    expect(initialSelectionState).toEqual({ mode: "off" });
  });

  it("enters with an empty selection and no notice", () => {
    expect(selectionReducer(initialSelectionState, { type: "enter", scope })).toEqual(selected([]));
  });

  it("ignores every action but enter while off", () => {
    const off = initialSelectionState;
    expect(selectionReducer(off, { type: "toggle_row", id: "a" })).toBe(off);
    expect(selectionReducer(off, { type: "select_page", ids: ["a"] })).toBe(off);
    expect(selectionReducer(off, { type: "unselect_page", ids: ["a"] })).toBe(off);
    expect(selectionReducer(off, { type: "clear" })).toBe(off);
    expect(selectionReducer(off, { type: "scope_changed", scope })).toBe(off);
    expect(selectionReducer(off, { type: "list_emptied" })).toBe(off);
    expect(selectionReducer(off, { type: "exit" })).toBe(off);
  });

  it("toggles a row in and out", () => {
    const added = selectionReducer(selected(["a"]), { type: "toggle_row", id: "b" });
    expect(added).toEqual(selected(["a", "b"]));
    const removed = selectionReducer(added, { type: "toggle_row", id: "a" });
    expect(removed).toEqual(selected(["b"]));
  });

  it("refuses a row past the limit", () => {
    const full = selected(ids(SELECTION_LIMIT));
    expect(selectionReducer(full, { type: "toggle_row", id: "new" })).toEqual(
      selected(ids(SELECTION_LIMIT), "limit"),
    );
  });

  it("allows removing a row at the limit and clears the notice", () => {
    const full = selected(ids(SELECTION_LIMIT), "limit");
    expect(selectionReducer(full, { type: "toggle_row", id: "id-0" })).toEqual(
      selected(ids(SELECTION_LIMIT).slice(1)),
    );
  });

  it("selects the page and keeps rows already selected", () => {
    expect(
      selectionReducer(selected(["a", "x"]), { type: "select_page", ids: ["a", "b"] }),
    ).toEqual(selected(["a", "x", "b"]));
  });

  it("refuses a page that would go past the limit as a whole", () => {
    const state = selected(ids(98));
    expect(selectionReducer(state, { type: "select_page", ids: ids(5, "new") })).toEqual(
      selected(ids(98), "limit"),
    );
  });

  it("allows a page that reaches the limit exactly", () => {
    const next = selectionReducer(selected(ids(95)), {
      type: "select_page",
      ids: ids(5, "new"),
    });
    expect(next.mode === "on" && next.selectedIds.size).toBe(SELECTION_LIMIT);
  });

  it("unselects only the given rows", () => {
    expect(
      selectionReducer(selected(["a", "b", "x"], "limit"), {
        type: "unselect_page",
        ids: ["a", "b"],
      }),
    ).toEqual(selected(["x"]));
  });

  it("clears the selection and stays on", () => {
    expect(selectionReducer(selected(["a"], "limit"), { type: "clear" })).toEqual(selected([]));
  });

  it("keeps the selection for the same scope", () => {
    const state = selected(["a"]);
    expect(selectionReducer(state, { type: "scope_changed", scope: { ...scope } })).toBe(state);
  });

  it("empties the selection when the status or the search changes", () => {
    expect(
      selectionReducer(selected(["a"]), {
        type: "scope_changed",
        scope: { status: "active", search: undefined },
      }),
    ).toEqual({
      mode: "on",
      scope: { status: "active", search: undefined },
      selectedIds: new Set(),
      notice: "scope_changed",
    });
    expect(
      selectionReducer(selected(["a"]), {
        type: "scope_changed",
        scope: { status: "all", search: "milk" },
      }),
    ).toEqual({
      mode: "on",
      scope: { status: "all", search: "milk" },
      selectedIds: new Set(),
      notice: "scope_changed",
    });
  });

  it("turns off on exit and when the list empties", () => {
    expect(selectionReducer(selected(["a"]), { type: "exit" })).toEqual({ mode: "off" });
    expect(selectionReducer(selected(["a"]), { type: "list_emptied" })).toEqual({ mode: "off" });
  });
});

describe("getSelectPageState", () => {
  it("is none for a page with no rows", () => {
    expect(getSelectPageState([], new Set(["a"]))).toBe("none");
  });

  it("is select when any visible row is missing", () => {
    expect(getSelectPageState(["a", "b"], new Set(["a"]))).toBe("select");
  });

  it("is unselect when every visible row is selected", () => {
    expect(getSelectPageState(["a", "b"], new Set(["a", "b", "x"]))).toBe("unselect");
  });
});

describe("getSelectedCountLabel", () => {
  it("names the count", () => {
    expect(getSelectedCountLabel(0)).toBe("0 selected");
    expect(getSelectedCountLabel(1)).toBe("1 selected");
    expect(getSelectedCountLabel(100)).toBe("100 selected");
  });
});

describe("getSelectionNoticeMessage", () => {
  it("explains each notice", () => {
    expect(getSelectionNoticeMessage("limit")).toBe(
      "You can select up to 100 todos. Unselect some to add more.",
    );
    expect(getSelectionNoticeMessage("scope_changed")).toBe(
      "Selection cleared because the view changed.",
    );
    expect(getSelectionNoticeMessage(null)).toBeNull();
  });
});
