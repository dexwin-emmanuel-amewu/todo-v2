import {
  internalErrorResponseSchema,
  todoSchema,
  validationErrorResponseSchema,
} from "@todo/contracts";
import { err, ok } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toCreateTodoResponse } from "./todo.routes.js";

describe("toCreateTodoResponse", () => {
  it("maps a successful create to 201 with the created todo", () => {
    const todo = {
      id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
      title: "Write the milestone plan",
      completed: false,
      createdAt: new Date().toISOString(),
    };

describe("toListTodosResponse", () => {
  it("maps an empty list to 200 with an empty items array", () => {
    const response = toListTodosResponse(ok([]));

    expect(response).toEqual({ status: 200, body: { items: [] } });
    expect(todoListResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a non-empty list to 200 with those items", () => {
    const response = toListTodosResponse(ok([exampleTodo]));

    expect(response).toEqual({ status: 200, body: { items: [exampleTodo] } });
    expect(todoListResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a database error to 500 with an internal error body", () => {
    const response = toListTodosResponse(err({ type: "database", cause: new Error("boom") }));

    expect(response).toEqual({ status: 500, body: { error: { type: "internal" } } });
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("maps a validation error to 500 with an internal error body", () => {
    const response = toListTodosResponse(err({ type: "validation", issues: ["bad row"] }));

    expect(response).toEqual({ status: 500, body: { error: { type: "internal" } } });
    expect(internalErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
