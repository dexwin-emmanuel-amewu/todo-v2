import {
  internalErrorResponseSchema,
  todoSchema,
  validationErrorResponseSchema,
} from "@todo/contracts";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { toCreateTodoResponse } from "./todo.routes.js";

describe("toCreateTodoResponse", () => {
  it("maps a successful create to 201 with the created todo", () => {
    const todo = {
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      title: "Write the milestone plan",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const response = toCreateTodoResponse(ok(todo));

    expect(response.status).toBe(201);
    expect(todoSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a request-body validation error to 400", () => {
    const response = toCreateTodoResponse(
      err({
        type: "request_validation",
        issues: ["Too small: expected string to have >=6 characters"],
      }),
    );

    expect(response.status).toBe(400);
    expect(validationErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a database error to 500 without leaking the cause", () => {
    const response = toCreateTodoResponse(
      err({ type: "database", cause: new Error("connection refused") }),
    );

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("connection refused");
  });

  it("maps a stored-row validation error to 500, not 400", () => {
    const response = toCreateTodoResponse(
      err({ type: "validation", issues: ["stored row failed todoSchema"] }),
    );

    expect(response.status).toBe(500);
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
