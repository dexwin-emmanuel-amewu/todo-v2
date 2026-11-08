import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TodoApiError } from "../api/todo.api";
import { TodoToggleAll } from "./TodoToggleAll";

type Props = Parameters<typeof TodoToggleAll>[0];

function renderToggle(overrides: Partial<Props> = {}) {
  const props: Props = {
    totalCount: 12,
    checked: false,
    desired: true,
    scoped: false,
    isPending: false,
    locked: false,
    result: null,
    error: null,
    onToggle: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<TodoToggleAll {...props} />);
  return props;
}

describe("TodoToggleAll", () => {
  it("names the whole collection and shows the checked value", () => {
    renderToggle();
    expect(
      screen.getByRole("checkbox", { name: "Mark all 12 todos as completed" }),
    ).not.toBeChecked();
  });

  it("is checked when every todo is completed", () => {
    renderToggle({ checked: true, desired: false });
    expect(screen.getByRole("checkbox", { name: "Mark all 12 todos as active" })).toBeChecked();
  });

  it("calls onToggle with the desired boolean", async () => {
    const props = renderToggle();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(props.onToggle).toHaveBeenCalledWith(true);
  });

  it("toggles with Space from the keyboard", async () => {
    const props = renderToggle({ checked: true, desired: false });
    await userEvent.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(props.onToggle).toHaveBeenCalledWith(false);
  });

  it("ignores clicks and keeps focus while pending", async () => {
    const props = renderToggle({ isPending: true, pendingCompleted: true });
    const checkbox = screen.getByRole("checkbox");

    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toBeEnabled();
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);

    expect(props.onToggle).not.toHaveBeenCalled();
    expect(checkbox).toHaveFocus();
    expect(checkbox).not.toBeChecked();
  });

  it("ignores clicks while a row change is pending", async () => {
    const props = renderToggle({ locked: true });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(checkbox);
    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it("announces the pending action", () => {
    renderToggle({ isPending: true, pendingCompleted: true });
    expect(screen.getByRole("status")).toHaveTextContent("Marking all todos as completed");
  });

  it("announces the result", () => {
    renderToggle({ result: { updatedCount: 3, completed: true } });
    expect(screen.getByRole("status")).toHaveTextContent("Marked 3 todos as completed.");
  });

  it("shows a safe alert with a retry on failure", async () => {
    const props = renderToggle({ error: new TodoApiError("http", "raw 500", { status: 500 }) });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The server could not update your todos. Try again.");
    expect(alert).not.toHaveTextContent("raw 500");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the alert while a retry is pending", () => {
    renderToggle({
      isPending: true,
      pendingCompleted: true,
      error: new TodoApiError("network", "offline"),
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the view note only when scoped", () => {
    const { unmount } = render(
      <TodoToggleAll
        totalCount={12}
        checked={false}
        desired
        scoped={false}
        isPending={false}
        locked={false}
        result={null}
        error={null}
        onToggle={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByText("Applies to all todos, not only this view.")).not.toBeInTheDocument();
    unmount();

    renderToggle({ scoped: true });
    expect(screen.getByText("Applies to all todos, not only this view.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Applies to all todos, not only this view.",
    );
  });
});
