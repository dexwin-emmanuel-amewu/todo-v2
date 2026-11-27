import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { TodoApiError } from "../api/todo.api";
import { TodoClearCompleted } from "./TodoClearCompleted";

type Props = Parameters<typeof TodoClearCompleted>[0];

function renderClear(overrides: Partial<Props> = {}) {
  const props: Props = {
    completedCount: 4,
    scoped: false,
    isPending: false,
    locked: false,
    deletedCount: null,
    error: null,
    onClear: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<TodoClearCompleted {...props} />);
  return props;
}

describe("TodoClearCompleted", () => {
  it("names the whole-collection completed count", () => {
    renderClear();
    expect(screen.getByRole("button", { name: "Clear all 4 completed todos" })).toBeVisible();
  });

  it("uses the singular for one completed todo", () => {
    renderClear({ completedCount: 1 });
    expect(screen.getByRole("button", { name: "Clear the 1 completed todo" })).toBeVisible();
  });

  it("hides the button but keeps the status region when nothing is completed", () => {
    renderClear({ completedCount: 0 });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onClear on click", async () => {
    const props = renderClear();
    await userEvent.click(screen.getByRole("button"));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("activates with Enter and Space from the keyboard", async () => {
    const props = renderClear();
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(props.onClear).toHaveBeenCalledTimes(2);
  });

  it("ignores clicks and keeps focus while pending", async () => {
    const props = renderClear({ isPending: true });
    const button = screen.getByRole("button", { name: "Clear all 4 completed todos" });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    button.focus();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(props.onClear).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("ignores clicks while another write is pending", async () => {
    const props = renderClear({ locked: true });
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("announces the pending state politely", () => {
    renderClear({ isPending: true });
    expect(screen.getByRole("status")).toHaveTextContent("Clearing completed todos");
  });

  it("announces the result even after the button hides", () => {
    renderClear({ completedCount: 0, deletedCount: 4 });
    expect(screen.getByRole("status")).toHaveTextContent("Cleared 4 completed todos.");
  });

  it("shows a safe alert with a retry on failure", async () => {
    const props = renderClear({ error: new TodoApiError("http", "boom", { status: 500 }) });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The server could not clear your completed todos. Try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("boom");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the alert while pending and when nothing is completed", () => {
    const error = new TodoApiError("network", "offline");
    const { unmount } = render(
      <TodoClearCompleted
        completedCount={4}
        scoped={false}
        isPending
        locked={false}
        deletedCount={null}
        error={error}
        onClear={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();

    renderClear({ completedCount: 0, error });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the view note only when scoped and links it to the button", () => {
    const { unmount } = render(
      <TodoClearCompleted
        completedCount={4}
        scoped={false}
        isPending={false}
        locked={false}
        deletedCount={null}
        error={null}
        onClear={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText("Applies to all todos, not only this view.")).not.toBeInTheDocument();
    unmount();

    renderClear({ scoped: true });
    expect(screen.getByRole("button")).toHaveAccessibleDescription(
      "Applies to all todos, not only this view.",
    );
  });

  it("passes the ref to the button", () => {
    const buttonRef = createRef<HTMLButtonElement>();
    renderClear({ buttonRef });
    expect(buttonRef.current).toBe(screen.getByRole("button"));
  });
});
