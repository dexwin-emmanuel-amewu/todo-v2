import type { Todo } from "@todo/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

  it("shows a checked state and action label for each todo", () => {
    render(<TodoList state={{ state: "ready", items }} />);

    expect(
      screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mark Water the plants as active" })).toBeChecked();
  });

  it("calls the completion handler with the requested state", async () => {
    const onToggle = vi.fn();
    render(
      <TodoList
        state={{ state: "ready", items }}
        completion={{
          isPending: false,
          error: null,
          onToggle,
          onRetry: vi.fn(),
        }}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }));

    expect(onToggle).toHaveBeenCalledWith(items[0].id, true);
  });

  it("keeps the server state visible and disables controls while pending", () => {
    render(
      <TodoList
        state={{ state: "ready", items }}
        completion={{
          isPending: true,
          pendingTodoId: items[0].id,
          error: null,
          onToggle: vi.fn(),
          onRetry: vi.fn(),
        }}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" });
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Updating…");
  });

  it("shows row failure feedback and retries the same mutation", async () => {
    const onRetry = vi.fn();
    render(
      <TodoList
        state={{ state: "ready", items }}
        completion={{
          isPending: false,
          pendingTodoId: items[0].id,
          error,
          errorTodoId: items[0].id,
          onToggle: vi.fn(),
          onRetry,
        }}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry update" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("enters edit mode on double-click with the current title selected", async () => {
    render(<TodoList state={{ state: "ready", items }} />);

    await userEvent.dblClick(screen.getByText("Buy oat milk"));

    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    expect(input).toHaveValue("Buy oat milk");
    expect(input).toHaveFocus();
    expect(input).toHaveProperty("selectionStart", 0);
    expect(input).toHaveProperty("selectionEnd", "Buy oat milk".length);
  });

  it("lets keyboard users enter edit mode and save the full PUT representation with Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TodoList state={{ state: "ready", items }} replacement={{ isPending: false, onSave }} />,
    );

    const editButton = screen.getByRole("button", { name: "Edit Buy oat milk" });
    editButton.focus();
    await userEvent.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    await userEvent.clear(input);
    await userEvent.type(input, "Buy oat milk tomorrow");
    await userEvent.keyboard("{Enter}");

    expect(onSave).toHaveBeenCalledWith(items[0].id, "Buy oat milk tomorrow", false);
    expect(await screen.findByRole("button", { name: "Edit Buy oat milk" })).toHaveFocus();
  });

  it("cancels with Escape, restores the original title, and makes no request", async () => {
    const onSave = vi.fn();
    render(
      <TodoList state={{ state: "ready", items }} replacement={{ isPending: false, onSave }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Buy oat milk" }));
    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    await userEvent.clear(input);
    await userEvent.type(input, "Changed title");
    await userEvent.keyboard("{Escape}");

    expect(screen.getByText("Buy oat milk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Buy oat milk" })).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows validation feedback and makes no request for an invalid title", async () => {
    const onSave = vi.fn();
    render(
      <TodoList state={{ state: "ready", items }} replacement={{ isPending: false, onSave }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Buy oat milk" }));
    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    await userEvent.clear(input);
    await userEvent.type(input, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Use at least 6 characters.")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the draft after failure and retries the same title and completion value", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("temporary failure"));
    onSave.mockResolvedValueOnce(undefined);
    render(
      <TodoList state={{ state: "ready", items }} replacement={{ isPending: false, onSave }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Buy oat milk" }));
    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    await userEvent.clear(input);
    await userEvent.type(input, "Buy oat milk tomorrow");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/draft is still here/i);
    expect(input).toHaveValue("Buy oat milk tomorrow");
    expect(input).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(onSave).toHaveBeenNthCalledWith(1, items[0].id, "Buy oat milk tomorrow", false);
    expect(onSave).toHaveBeenNthCalledWith(2, items[0].id, "Buy oat milk tomorrow", false);
    expect(await screen.findByRole("button", { name: "Edit Buy oat milk" })).toHaveFocus();
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

  it("re-enables the other rows when the row being edited disappears", async () => {
    const { rerender } = render(<TodoList state={{ state: "ready", items }} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit Buy oat milk" }));
    expect(screen.getByRole("button", { name: "Edit Water the plants" })).toBeDisabled();

    rerender(<TodoList state={{ state: "ready", items: items.slice(1) }} />);

    expect(screen.getByRole("button", { name: "Edit Water the plants" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Water the plants" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Mark Water the plants as active" })).toBeEnabled();
  });

  it("keeps the draft being edited when the list refreshes in the background", async () => {
    const { rerender } = render(<TodoList state={{ state: "ready", items }} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit Buy oat milk" }));
    const input = screen.getByRole("textbox", { name: "Edit title for Buy oat milk" });
    await userEvent.clear(input);
    await userEvent.type(input, "Buy almond milk");

    rerender(<TodoList state={{ state: "refreshing", items }} />);
    expect(screen.getByRole("textbox", { name: "Edit title for Buy oat milk" })).toHaveValue(
      "Buy almond milk",
    );

    rerender(<TodoList state={{ state: "refresh_failure", items, error, retry: vi.fn() }} />);
    expect(screen.getByRole("textbox", { name: "Edit title for Buy oat milk" })).toHaveValue(
      "Buy almond milk",
    );

    rerender(<TodoList state={{ state: "ready", items }} />);
    expect(screen.getByRole("textbox", { name: "Edit title for Buy oat milk" })).toHaveValue(
      "Buy almond milk",
    );
  });

  describe("deletion", () => {
    const idle = { isPending: false, error: null };

    it("labels each Delete button with the todo title and dispatches that row's id", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(<TodoList state={{ state: "ready", items }} deletion={{ ...idle, onDelete }} />);

      await userEvent.click(screen.getByRole("button", { name: "Delete Water the plants" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(items[1].id);
    });

    it("disables the action, announces progress, and dispatches once on repeat activation", async () => {
      let resolve: () => void = () => {};
      const onDelete = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));

      function Harness() {
        const [pending, setPending] = useState(false);
        return (
          <TodoList
            state={{ state: "ready", items }}
            deletion={{
              isPending: pending,
              pendingTodoId: items[0].id,
              error: null,
              onDelete: (id) => {
                setPending(true);
                return onDelete(id);
              },
            }}
          />
        );
      }
      render(<Harness />);

      const button = screen.getByRole("button", { name: "Delete Buy oat milk" });
      await userEvent.click(button);
      await userEvent.click(button);
      button.focus();
      await userEvent.keyboard("{Enter}");

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("Deleting Buy oat milk");
      resolve();
    });

    it("keeps the row and offers retry after a failure", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <TodoList
          state={{ state: "ready", items }}
          deletion={{ isPending: false, error, errorTodoId: items[0].id, onDelete }}
        />,
      );

      expect(screen.getByText("Buy oat milk")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i);
      await userEvent.click(screen.getByRole("button", { name: "Retry delete" }));
      expect(onDelete).toHaveBeenCalledWith(items[0].id);
    });

    it("explains a 404 when the row is still showing", () => {
      render(
        <TodoList
          state={{ state: "ready", items }}
          deletion={{
            isPending: false,
            error: new TodoApiError("http", "missing", { status: 404 }),
            errorTodoId: items[0].id,
            onDelete: vi.fn(),
          }}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(/no longer exists/i);
    });

    function Deleting({ initial }: { initial: Todo[] }) {
      const [list, setList] = useState(initial);
      return (
        <>
          <button type="button">Elsewhere</button>
          <TodoList
            state={{ state: "ready", items: list }}
            deletion={{
              isPending: false,
              error: null,
              onDelete: async (id) => setList((current) => current.filter((t) => t.id !== id)),
            }}
          />
        </>
      );
    }

    it("focuses the next row's Delete action after removal", async () => {
      render(<Deleting initial={items} />);

      await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));

      expect(screen.getByRole("button", { name: "Delete Water the plants" })).toHaveFocus();
    });

    it("focuses the previous row's Delete action when the last row is removed", async () => {
      render(<Deleting initial={items} />);

      await userEvent.click(
        screen.getByRole("button", { name: "Delete Renew the parking permit" }),
      );

      expect(screen.getByRole("button", { name: "Delete Water the plants" })).toHaveFocus();
    });

    it("focuses the empty-state heading when the only row is removed", async () => {
      render(<Deleting initial={[items[0]]} />);

      await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));

      expect(screen.getByRole("heading", { name: /no todos yet/i })).toHaveFocus();
    });

    it("does not steal focus when the user moved it while deletion was pending", async () => {
      let finish: () => void = () => {};
      function Slow() {
        const [list, setList] = useState(items);
        return (
          <>
            <button type="button">Elsewhere</button>
            <TodoList
              state={{ state: "ready", items: list }}
              deletion={{
                isPending: false,
                error: null,
                onDelete: (id) =>
                  new Promise<void>((r) => {
                    finish = () => {
                      setList((current) => current.filter((t) => t.id !== id));
                      r();
                    };
                  }),
              }}
            />
          </>
        );
      }
      render(<Slow />);

      await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));
      screen.getByRole("button", { name: "Elsewhere" }).focus();
      finish();

      await waitFor(() => expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    });
  });

  describe("status filter", () => {
    it("shows a count for each filter from the server total", () => {
      const { rerender } = render(
        <TodoList state={{ state: "ready", items }} filter="all" totalItems={3} />,
      );
      expect(screen.getByText("3 todos")).toBeInTheDocument();

      rerender(
        <TodoList state={{ state: "ready", items: [items[0]] }} filter="active" totalItems={1} />,
      );
      expect(screen.getByText("1 active todo")).toBeInTheDocument();

      rerender(
        <TodoList
          state={{ state: "ready", items: [items[1]] }}
          filter="completed"
          totalItems={25}
        />,
      );
      expect(screen.getByText("25 completed todos")).toBeInTheDocument();
    });

    it("shows no count while the first load for a filter is in progress", () => {
      render(<TodoList state={{ state: "initial_loading" }} filter="active" />);

      expect(screen.getByRole("status")).toHaveTextContent("Loading todos");
      expect(screen.queryByText(/active todo/)).not.toBeInTheDocument();
    });

    it.each([
      ["all", "No todos yet."],
      ["active", "No active todos."],
      ["completed", "No completed todos."],
    ] as const)("shows the %s empty message and no count", (filter, message) => {
      render(<TodoList state={{ state: "ready", items: [] }} filter={filter} totalItems={0} />);

      expect(screen.getByRole("heading", { name: message })).toBeInTheDocument();
      expect(screen.queryByText(/^0 /)).not.toBeInTheDocument();
    });
  });
});
