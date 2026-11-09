import { match, P } from "ts-pattern";

import { TodoApiError } from "../api/todo.api";
import type { TodoSummary } from "./todo.toggleAll";

export type ClearCompletedState =
  { state: "hidden" } | { state: "visible"; completedCount: number };

export function getClearCompletedState({
  totalCount,
  activeCount,
}: TodoSummary): ClearCompletedState {
  const completedCount = totalCount - activeCount;
  if (completedCount <= 0) return { state: "hidden" };
  return { state: "visible", completedCount };
}

export function getClearCompletedLabel(completedCount: number): string {
  return completedCount === 1
    ? "Clear the 1 completed todo"
    : `Clear all ${completedCount} completed todos`;
}

export function getClearCompletedPendingMessage(): string {
  return "Clearing completed todos";
}

export function getClearCompletedResultMessage(deletedCount: number): string {
  if (deletedCount === 0) return "There were no completed todos to clear.";
  const noun = deletedCount === 1 ? "todo" : "todos";
  return `Cleared ${deletedCount} completed ${noun}.`;
}

export function getClearCompletedErrorMessage(error: unknown): string {
  return match(error)
    .with(P.instanceOf(TodoApiError), ({ type, status }) =>
      match({ type, status })
        .with(
          { type: "request_validation" },
          { type: "http", status: 400 },
          () => "The completed todos could not be cleared. Refresh and try again.",
        )
        .with({ type: "http" }, () => "The server could not clear your completed todos. Try again.")
        .with(
          { type: "network" },
          () => "Could not reach the server. Check your connection and try again.",
        )
        .with(
          { type: "response_validation" },
          () => "The server returned an unexpected response. Refresh to see your todos.",
        )
        .exhaustive(),
    )
    .otherwise(() => "Something went wrong. Try again.");
}
