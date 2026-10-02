import { type TodoListResponse, todoListResponseSchema } from "@todo/contracts";

export const TODO_API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export type TodoApiErrorType = "network" | "http" | "response_validation";

export class TodoApiError extends Error {
  readonly type: TodoApiErrorType;
  readonly status?: number;
  readonly issues?: string[];

  constructor(
    type: TodoApiErrorType,
    message: string,
    details: { status?: number; issues?: string[]; cause?: unknown } = {},
  ) {
    super(message, { cause: details.cause });
    this.name = "TodoApiError";
    this.type = type;
    this.status = details.status;
    this.issues = details.issues;
  }
}

export async function fetchTodoList(): Promise<TodoListResponse> {
  let response: Response;

  try {
    response = await fetch(`${TODO_API_BASE_URL}/todos`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new TodoApiError("network", "Could not reach the API.", { cause });
  }

  if (!response.ok) {
    throw new TodoApiError("http", `The API responded with ${response.status}.`, {
      status: response.status,
    });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (cause) {
    throw new TodoApiError("response_validation", "The API response was not valid JSON.", {
      cause,
    });
  }

  const parsed = todoListResponseSchema.safeParse(body);

  if (!parsed.success) {
    throw new TodoApiError("response_validation", "The API response did not match the contract.", {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }

  return parsed.data;
}
