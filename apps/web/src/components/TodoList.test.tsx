import type { Todo } from "@todo/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TodoApiError } from "../api/todo.api";
import { TodoList } from "./TodoList";

const items: Todo[] = [
  {
    id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
    title: "Buy oat milk",
    completed: false,
    createdAt: "2026-09-30T10:00:00.000Z",
  },
  {
    id: "6e2d4c3b-7c2b-4c8b-8c2b-7c2b4c8b8c2b",
    title: "Water the plants",
    completed: true,
    createdAt: "2026-09-30T11:00:00.000Z",
  },
  {
    id: "7f3e5d4c-8d3c-4d7c-9d3c-8d3c4d7c9d3c",
    title: "Renew the parking permit",
    completed: false,
    createdAt: "2026-09-30T12:00:00.000Z",
  },
];

const error = new TodoApiError("network", "Could not reach the API.");

describe("TodoList", () => {
  it("shows a polite loading status and no list while loading", () => {
    render(<TodoList state={{ state: "initial_loading" }} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/loading todos/i);
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders one list item per todo, in the given order", () => {
    render(<TodoList state={{ state: "ready", items }} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
    expect(listItems.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Buy oat milk"),
      expect.stringContaining("Water the plants"),
      expect.stringContaining("Renew the parking permit"),
    ]);
  });

  it("exposes each todo's completed state as text", () => {
    render(<TodoList state={{ state: "ready", items }} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems[0]).toHaveTextContent(/buy oat milk/i);
    expect(listItems[0]).toHaveTextContent(/active/i);
    expect(listItems[1]).toHaveTextContent(/water the plants/i);
    expect(listItems[1]).toHaveTextContent(/completed/i);
  });

  it("shows the empty message and no list when there are no todos", () => {
    render(<TodoList state={{ state: "ready", items: [] }} />);

    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an alert and a retry button on an initial failure, with no list", () => {
    render(<TodoList state={{ state: "initial_failure", error, retry: vi.fn() }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/could not load your todos/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("calls retry once when the retry button is pressed", async () => {
    const retry = vi.fn();
    render(<TodoList state={{ state: "initial_failure", error, retry }} />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps the list, marks it busy, and announces politely while refreshing", () => {
    render(<TodoList state={{ state: "refreshing", items }} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/refreshing/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the previous list alongside an alert on a refresh failure", () => {
    render(<TodoList state={{ state: "refresh_failure", items, error, retry: vi.fn() }} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Buy oat milk")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not refresh your todos/i);
  });

  it("calls retry once from a refresh failure", async () => {
    const retry = vi.fn();
    render(<TodoList state={{ state: "refresh_failure", items, error, retry }} />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
