import { match, P } from "ts-pattern";

import { TodoApiError } from "../api/todo.api";

function getStateWord(completed: boolean): string {
  return completed ? "completed" : "active";
}

function getTodoCount(count: number): string {
  return count === 1 ? "1 todo" : `${count} todos`;
}

function getMissingIds(error: unknown): string[] {
  return error instanceof TodoApiError && error.type === "batch_conflict"
    ? (error.missingIds ?? [])
    : [];
}

export function getBatchPendingMessage({
  count,
  completed,
}: {
  count: number;
  completed: boolean;
}): string {
  return `Marking ${getTodoCount(count)} as ${getStateWord(completed)}`;
}

export function getBatchResultMessage({
  updatedCount,
  completed,
}: {
  updatedCount: number;
  completed: boolean;
}): string {
  return `${getTodoCount(updatedCount)} marked as ${getStateWord(completed)}`;
}

// A conflict retries only the ids that still exist. Any other failure retries every id.
export function getBatchRetryIds(error: unknown, ids: readonly string[]): string[] {
  const missing = new Set(getMissingIds(error));
  return ids.filter((id) => !missing.has(id));
}

export function getBatchErrorMessage(error: unknown, ids: readonly string[]): string {
  return match(error)
    .with(P.instanceOf(TodoApiError).and({ type: "batch_conflict" }), (conflict) => {
      const removedCount = getMissingIds(conflict).length;
      if (getBatchRetryIds(conflict, ids).length === 0) {
        return "None of the selected todos exist anymore. Nothing was changed.";
      }
      return removedCount === 1
        ? "1 selected todo no longer exists. It was removed from the selection. Nothing was changed."
        : `${removedCount} selected todos no longer exist. They were removed from the selection. Nothing was changed.`;
    })
    .otherwise(() => "Could not update the selected todos. Nothing was changed.");
}
