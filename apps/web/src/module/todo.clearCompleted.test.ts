import { describe, expect, it } from "vitest";

import { TodoApiError } from "../api/todo.api";
import {
  getClearCompletedErrorMessage,
  getClearCompletedLabel,
  getClearCompletedPendingMessage,
  getClearCompletedResultMessage,
  getClearCompletedState,
} from "./todo.clearCompleted";

describe("getClearCompletedState", () => {
  it("is hidden when no todo is completed", () => {
    expect(getClearCompletedState({ totalCount: 12, activeCount: 12 })).toEqual({
      state: "hidden",
    });
  });

  it("is hidden when the collection is empty", () => {
    expect(getClearCompletedState({ totalCount: 0, activeCount: 0 })).toEqual({
      state: "hidden",
    });
  });

  it("counts the completed todos in the whole collection", () => {
    expect(getClearCompletedState({ totalCount: 12, activeCount: 8 })).toEqual({
      state: "visible",
      completedCount: 4,
    });
  });
});

describe("getClearCompletedLabel", () => {
  it("names the whole-collection completed count", () => {
    expect(getClearCompletedLabel(4)).toBe("Clear all 4 completed todos");
    expect(getClearCompletedLabel(1)).toBe("Clear the 1 completed todo");
  });
});

describe("getClearCompletedPendingMessage", () => {
  it("names the action in progress", () => {
    expect(getClearCompletedPendingMessage()).toBe("Clearing completed todos");
  });
});

describe("getClearCompletedResultMessage", () => {
  it("reports the deleted count", () => {
    expect(getClearCompletedResultMessage(4)).toBe("Cleared 4 completed todos.");
    expect(getClearCompletedResultMessage(1)).toBe("Cleared 1 completed todo.");
  });

  it("reports when nothing was deleted", () => {
    expect(getClearCompletedResultMessage(0)).toBe("There were no completed todos to clear.");
  });
});

describe("getClearCompletedErrorMessage", () => {
  it("maps each failure to a safe message", () => {
    expect(getClearCompletedErrorMessage(new TodoApiError("http", "bad", { status: 400 }))).toBe(
      "The completed todos could not be cleared. Refresh and try again.",
    );
    expect(getClearCompletedErrorMessage(new TodoApiError("request_validation", "bad"))).toBe(
      "The completed todos could not be cleared. Refresh and try again.",
    );
    expect(getClearCompletedErrorMessage(new TodoApiError("http", "boom", { status: 500 }))).toBe(
      "The server could not clear your completed todos. Try again.",
    );
    expect(getClearCompletedErrorMessage(new TodoApiError("network", "offline"))).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
    expect(getClearCompletedErrorMessage(new TodoApiError("response_validation", "odd"))).toBe(
      "The server returned an unexpected response. Refresh to see your todos.",
    );
    expect(getClearCompletedErrorMessage(new Error("raw detail"))).toBe(
      "Something went wrong. Try again.",
    );
  });
});
