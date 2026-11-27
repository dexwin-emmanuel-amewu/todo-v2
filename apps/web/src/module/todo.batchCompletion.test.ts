import { describe, expect, it } from "vitest";

import { TodoApiError } from "../api/todo.api";
import {
  getBatchErrorMessage,
  getBatchPendingMessage,
  getBatchResultMessage,
  getBatchRetryIds,
} from "./todo.batchCompletion";

function conflict(...missingIds: string[]) {
  return new TodoApiError("batch_conflict", "conflict", { status: 409, missingIds });
}

describe("getBatchPendingMessage", () => {
  it("names the count and the target state", () => {
    expect(getBatchPendingMessage({ count: 3, completed: true })).toBe(
      "Marking 3 todos as completed",
    );
    expect(getBatchPendingMessage({ count: 1, completed: false })).toBe("Marking 1 todo as active");
  });
});

describe("getBatchResultMessage", () => {
  it("names the count and the target state", () => {
    expect(getBatchResultMessage({ updatedCount: 3, completed: true })).toBe(
      "3 todos marked as completed",
    );
    expect(getBatchResultMessage({ updatedCount: 1, completed: false })).toBe(
      "1 todo marked as active",
    );
  });
});

describe("getBatchRetryIds", () => {
  it("drops the missing ids after a conflict", () => {
    expect(getBatchRetryIds(conflict("b"), ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("keeps every id after any other failure", () => {
    expect(getBatchRetryIds(new TodoApiError("http", "boom", { status: 500 }), ["a", "b"])).toEqual(
      ["a", "b"],
    );
    expect(getBatchRetryIds(new Error("boom"), ["a"])).toEqual(["a"]);
  });
});

describe("getBatchErrorMessage", () => {
  it("explains a conflict with todos left to retry", () => {
    expect(getBatchErrorMessage(conflict("b", "c"), ["a", "b", "c"])).toBe(
      "2 selected todos no longer exist. They were removed from the selection. Nothing was changed.",
    );
    expect(getBatchErrorMessage(conflict("b"), ["a", "b"])).toBe(
      "1 selected todo no longer exists. It was removed from the selection. Nothing was changed.",
    );
  });

  it("explains a conflict with nothing left", () => {
    expect(getBatchErrorMessage(conflict("a", "b"), ["a", "b"])).toBe(
      "None of the selected todos exist anymore. Nothing was changed.",
    );
  });

  it("explains any other failure", () => {
    for (const error of [
      new TodoApiError("network", "offline"),
      new TodoApiError("http", "bad", { status: 400 }),
      new TodoApiError("http", "boom", { status: 500 }),
      new TodoApiError("response_validation", "bad"),
      new Error("boom"),
    ]) {
      expect(getBatchErrorMessage(error, ["a"])).toBe(
        "Could not update the selected todos. Nothing was changed.",
      );
    }
  });
});
