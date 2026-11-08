import { match, P } from "ts-pattern";

import { TodoApiError } from "../api/todo.api";

export type TodoSummary = { totalCount: number; activeCount: number };

export type ToggleAllState =
  | { state: "hidden" }
  | { state: "visible"; checked: boolean; desired: boolean; totalCount: number };

export function getToggleAllState({ totalCount, activeCount }: TodoSummary): ToggleAllState {
  if (totalCount === 0) return { state: "hidden" };
  return { state: "visible", checked: activeCount === 0, desired: activeCount > 0, totalCount };
}

function getStateWord(completed: boolean): string {
  return completed ? "completed" : "active";
}

export function getToggleAllLabel({
  totalCount,
  desired,
}: {
  totalCount: number;
  desired: boolean;
}): string {
  const scope = totalCount === 1 ? "the 1 todo" : `all ${totalCount} todos`;
  return `Mark ${scope} as ${getStateWord(desired)}`;
}

export function getToggleAllPendingMessage(completed: boolean): string {
  return `Marking all todos as ${getStateWord(completed)}`;
}

export function getToggleAllResultMessage({
  updatedCount,
  completed,
}: {
  updatedCount: number;
  completed: boolean;
}): string {
  if (updatedCount === 0) return `All todos were already ${getStateWord(completed)}.`;
  const noun = updatedCount === 1 ? "todo" : "todos";
  return `Marked ${updatedCount} ${noun} as ${getStateWord(completed)}.`;
}

export function getToggleAllErrorMessage(error: unknown): string {
  return match(error)
    .with(P.instanceOf(TodoApiError), ({ type, status }) =>
      match({ type, status })
        .with(
          { type: "request_validation" },
          { type: "http", status: 400 },
          () => "The todos could not be updated. Refresh and try again.",
        )
        .with({ type: "http" }, () => "The server could not update your todos. Try again.")
        .with({ type: "network" }, () => "Could not reach the server. Your todos were not changed.")
        .with(
          { type: "response_validation" },
          () => "The server returned an unexpected response. Refresh to see your todos.",
        )
        .exhaustive(),
    )
    .otherwise(() => "Something went wrong. Try again.");
}
