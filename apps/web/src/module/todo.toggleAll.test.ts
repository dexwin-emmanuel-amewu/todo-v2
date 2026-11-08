import { describe, expect, it } from "vitest";

import { TodoApiError } from "../api/todo.api";
import {
  getToggleAllErrorMessage,
  getToggleAllLabel,
  getToggleAllPendingMessage,
  getToggleAllResultMessage,
  getToggleAllState,
} from "./todo.toggleAll";

describe("getToggleAllState", () => {
  it("is hidden when the collection is empty", () => {
    expect(getToggleAllState({ totalCount: 0, activeCount: 0 })).toEqual({ state: "hidden" });
  });

  it("marks all as completed when any todo is active", () => {
    expect(getToggleAllState({ totalCount: 12, activeCount: 3 })).toEqual({
      state: "visible",
      checked: false,
      desired: true,
      totalCount: 12,
    });
  });

  it("marks all as active when every todo is completed", () => {
    expect(getToggleAllState({ totalCount: 12, activeCount: 0 })).toEqual({
      state: "visible",
      checked: true,
      desired: false,
      totalCount: 12,
    });
  });
});

describe("getToggleAllLabel", () => {
  it("names the whole collection and the action", () => {
    expect(getToggleAllLabel({ totalCount: 12, desired: true })).toBe(
      "Mark all 12 todos as completed",
    );
    expect(getToggleAllLabel({ totalCount: 12, desired: false })).toBe(
      "Mark all 12 todos as active",
    );
    expect(getToggleAllLabel({ totalCount: 1, desired: true })).toBe(
      "Mark the 1 todo as completed",
    );
  });
});

describe("getToggleAllPendingMessage", () => {
  it("names the action in progress", () => {
    expect(getToggleAllPendingMessage(true)).toBe("Marking all todos as completed");
    expect(getToggleAllPendingMessage(false)).toBe("Marking all todos as active");
  });
});

describe("getToggleAllResultMessage", () => {
  it("reports the changed count", () => {
    expect(getToggleAllResultMessage({ updatedCount: 3, completed: true })).toBe(
      "Marked 3 todos as completed.",
    );
    expect(getToggleAllResultMessage({ updatedCount: 1, completed: false })).toBe(
      "Marked 1 todo as active.",
    );
  });

  it("reports when nothing changed", () => {
    expect(getToggleAllResultMessage({ updatedCount: 0, completed: true })).toBe(
      "All todos were already completed.",
    );
    expect(getToggleAllResultMessage({ updatedCount: 0, completed: false })).toBe(
      "All todos were already active.",
    );
  });
});

describe("getToggleAllErrorMessage", () => {
  it("maps each failure to a safe message", () => {
    expect(getToggleAllErrorMessage(new TodoApiError("request_validation", "bad"))).toBe(
      "The todos could not be updated. Refresh and try again.",
    );
    expect(getToggleAllErrorMessage(new TodoApiError("http", "bad", { status: 400 }))).toBe(
      "The todos could not be updated. Refresh and try again.",
    );
    expect(getToggleAllErrorMessage(new TodoApiError("http", "boom", { status: 500 }))).toBe(
      "The server could not update your todos. Try again.",
    );
    expect(getToggleAllErrorMessage(new TodoApiError("network", "offline"))).toBe(
      "Could not reach the server. Your todos were not changed.",
    );
    expect(getToggleAllErrorMessage(new TodoApiError("response_validation", "odd"))).toBe(
      "The server returned an unexpected response. Refresh to see your todos.",
    );
    expect(getToggleAllErrorMessage(new Error("raw detail"))).toBe(
      "Something went wrong. Try again.",
    );
  });
});
