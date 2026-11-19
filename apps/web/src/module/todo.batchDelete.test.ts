import { describe, expect, it } from "vitest";

import { TodoApiError } from "../api/todo.api";
import {
  getBatchDeleteErrorMessage,
  getBatchDeleteLabel,
  getBatchDeletePendingMessage,
  getBatchDeleteResultMessage,
} from "./todo.batchDelete";

function conflict(...missingIds: string[]) {
  return new TodoApiError("batch_conflict", "conflict", { status: 409, missingIds });
}

describe("getBatchDeleteLabel", () => {
  it("names the selected count", () => {
    expect(getBatchDeleteLabel(0)).toBe("Delete selected todos");
    expect(getBatchDeleteLabel(1)).toBe("Delete 1 selected todo");
    expect(getBatchDeleteLabel(3)).toBe("Delete 3 selected todos");
  });
});

describe("getBatchDeletePendingMessage", () => {
  it("names the count", () => {
    expect(getBatchDeletePendingMessage(1)).toBe("Deleting 1 todo");
    expect(getBatchDeletePendingMessage(3)).toBe("Deleting 3 todos");
  });
});

describe("getBatchDeleteResultMessage", () => {
  it("names the count", () => {
    expect(getBatchDeleteResultMessage(1)).toBe("Deleted 1 todo.");
    expect(getBatchDeleteResultMessage(3)).toBe("Deleted 3 todos.");
  });
});

describe("getBatchDeleteErrorMessage", () => {
  it("explains a conflict that removed one id", () => {
    expect(getBatchDeleteErrorMessage(conflict("b"), ["a", "b"])).toBe(
      "1 selected todo no longer exists. It was removed from the selection. Nothing was deleted.",
    );
  });

  it("explains a conflict that removed several ids", () => {
    expect(getBatchDeleteErrorMessage(conflict("b", "c"), ["a", "b", "c"])).toBe(
      "2 selected todos no longer exist. They were removed from the selection. Nothing was deleted.",
    );
  });

  it("explains a conflict that left no ids", () => {
    expect(getBatchDeleteErrorMessage(conflict("a"), ["a"])).toBe(
      "None of the selected todos exist anymore. Nothing was deleted.",
    );
  });

  it("uses one message for every other failure", () => {
    const expected = "Could not delete the selected todos. Nothing was deleted.";
    expect(getBatchDeleteErrorMessage(new TodoApiError("network", "offline"), ["a"])).toBe(
      expected,
    );
    expect(
      getBatchDeleteErrorMessage(new TodoApiError("http", "boom", { status: 500 }), ["a"]),
    ).toBe(expected);
    expect(getBatchDeleteErrorMessage(new Error("boom"), ["a"])).toBe(expected);
  });
});
