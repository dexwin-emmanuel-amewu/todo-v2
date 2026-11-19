import { TodoApiError } from "../api/todo.api";
import { getBatchRetryIds } from "./todo.batchCompletion";

function getTodoCount(count: number): string {
  return count === 1 ? "1 todo" : `${count} todos`;
}

export function getBatchDeleteLabel(selectedCount: number): string {
  if (selectedCount === 0) return "Delete selected todos";
  return selectedCount === 1 ? "Delete 1 selected todo" : `Delete ${selectedCount} selected todos`;
}

export function getBatchDeletePendingMessage(count: number): string {
  return `Deleting ${getTodoCount(count)}`;
}

export function getBatchDeleteResultMessage(deletedCount: number): string {
  return `Deleted ${getTodoCount(deletedCount)}.`;
}

export function getBatchDeleteErrorMessage(error: unknown, ids: readonly string[]): string {
  if (!(error instanceof TodoApiError) || error.type !== "batch_conflict") {
    return "Could not delete the selected todos. Nothing was deleted.";
  }
  if (getBatchRetryIds(error, ids).length === 0) {
    return "None of the selected todos exist anymore. Nothing was deleted.";
  }
  const removedCount = error.missingIds?.length ?? 0;
  return removedCount === 1
    ? "1 selected todo no longer exists. It was removed from the selection. Nothing was deleted."
    : `${removedCount} selected todos no longer exist. They were removed from the selection. Nothing was deleted.`;
}
