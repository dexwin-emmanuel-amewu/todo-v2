import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { TodoApiError } from "../api/todo.api";
import { TodoSelectButton, TodoSelectionBar } from "./TodoSelectionBar";

type BarProps = Parameters<typeof TodoSelectionBar>[0];

function renderBar(overrides: Partial<BarProps> = {}) {
  const props: BarProps = {
    selectedCount: 0,
    pageState: "select",
    notice: null,
    onSelectPage: vi.fn(),
    onUnselectPage: vi.fn(),
    onClear: vi.fn(),
    onDone: vi.fn(),
    isPending: false,
    result: null,
    error: null,
    onMarkSelected: vi.fn(),
    onRetry: vi.fn(),
    deleteResult: null,
    deleteError: null,
    onDeleteSelected: vi.fn(),
    onRetryDelete: vi.fn(),
    ...overrides,
  };
  render(<TodoSelectionBar {...props} />);
  return props;
}

describe("TodoSelectButton", () => {
  it("calls onEnter when clicked", async () => {
    const onEnter = vi.fn();
    render(<TodoSelectButton locked={false} onEnter={onEnter} />);
    await userEvent.click(screen.getByRole("button", { name: "Select todos" }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("is aria-disabled, keeps focus, and ignores clicks when locked", async () => {
    const onEnter = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(<TodoSelectButton locked onEnter={onEnter} buttonRef={ref} />);
    const button = screen.getByRole("button", { name: "Select todos" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    button.focus();
    await userEvent.click(button);
    expect(onEnter).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    expect(ref.current).toBe(button);
  });
});

describe("TodoSelectionBar", () => {
  it("renders a Selection group with the count and every control", () => {
    renderBar();
    const group = screen.getByRole("group", { name: "Selection" });
    expect(within(group).getByText("0 selected")).toBeVisible();
    expect(within(group).getByRole("button", { name: "Select this page" })).toBeVisible();
    expect(within(group).getByRole("button", { name: "Clear selection" })).toBeVisible();
    expect(within(group).getByRole("button", { name: "Done" })).toBeVisible();
  });

  it("keeps the count, the notice, and the batch status in separate polite regions", () => {
    renderBar({ selectedCount: 3, notice: "limit" });
    const regions = screen.getAllByRole("status");
    expect(regions).toHaveLength(3);
    for (const region of regions) expect(region).toHaveAttribute("aria-live", "polite");
    expect(regions[0]).toHaveTextContent("3 selected");
    expect(regions[2]).toHaveTextContent(
      "You can select up to 100 todos. Unselect some to add more.",
    );
  });

  it("shows the scope message", () => {
    renderBar({ notice: "scope_changed" });
    expect(screen.getByText("Selection cleared because the view changed.")).toBeVisible();
  });

  it("offers to unselect the page when every row is selected", async () => {
    const props = renderBar({ selectedCount: 2, pageState: "unselect" });
    await userEvent.click(screen.getByRole("button", { name: "Unselect this page" }));
    expect(props.onUnselectPage).toHaveBeenCalledTimes(1);
    expect(props.onSelectPage).not.toHaveBeenCalled();
  });

  it("disables Clear selection when nothing is selected", async () => {
    const props = renderBar({ selectedCount: 0 });
    const button = screen.getByRole("button", { name: "Clear selection" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("disables Select this page when the page has no rows", async () => {
    const props = renderBar({ pageState: "none" });
    const button = screen.getByRole("button", { name: "Select this page" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(props.onSelectPage).not.toHaveBeenCalled();
  });

  it("calls each handler", async () => {
    const pageButtonRef = createRef<HTMLButtonElement>();
    const props = renderBar({ selectedCount: 2, pageButtonRef });
    await userEvent.click(screen.getByRole("button", { name: "Select this page" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onSelectPage).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(props.onDone).toHaveBeenCalledTimes(1);
    expect(pageButtonRef.current).toBe(screen.getByRole("button", { name: "Select this page" }));
  });
});

describe("TodoSelectionBar, batch completion", () => {
  const completedName = { name: "Mark selected as completed" };
  const activeName = { name: "Mark selected as active" };

  it("disables both batch buttons when nothing is selected", async () => {
    const props = renderBar({ selectedCount: 0 });

    for (const name of [completedName, activeName]) {
      const button = screen.getByRole("button", name);
      expect(button).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(button);
    }
    expect(props.onMarkSelected).not.toHaveBeenCalled();
  });

  it("calls onMarkSelected with the matching boolean", async () => {
    const props = renderBar({ selectedCount: 2 });

    await userEvent.click(screen.getByRole("button", completedName));
    await userEvent.click(screen.getByRole("button", activeName));

    expect(props.onMarkSelected).toHaveBeenNthCalledWith(1, true);
    expect(props.onMarkSelected).toHaveBeenNthCalledWith(2, false);
  });

  const ids = ["a", "b", "c"];

  it("locks every control while pending", async () => {
    const props = renderBar({
      selectedCount: 2,
      isPending: true,
      input: { ids, completed: true },
    });

    for (const name of [
      "Select this page",
      "Clear selection",
      "Done",
      "Mark selected as completed",
      "Mark selected as active",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(button);
    }
    expect(props.onSelectPage).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
    expect(props.onMarkSelected).not.toHaveBeenCalled();
  });

  it("shows the pending message in a polite status region", () => {
    renderBar({ selectedCount: 3, isPending: true, input: { ids, completed: true } });

    const statuses = screen.getAllByRole("status");
    expect(statuses.some((status) => status.textContent === "Marking 3 todos as completed")).toBe(
      true,
    );
  });

  it("shows the result message in a polite status region", () => {
    renderBar({ result: { updatedCount: 1, completed: false } });

    const statuses = screen.getAllByRole("status");
    expect(statuses.some((status) => status.textContent === "1 todo marked as active")).toBe(true);
  });

  it("shows a failure alert with Retry", async () => {
    const props = renderBar({
      selectedCount: 3,
      input: { ids, completed: true },
      error: new TodoApiError("http", "boom", { status: 500 }),
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not update the selected todos. Nothing was changed.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the alert while a request is pending", () => {
    renderBar({
      isPending: true,
      input: { ids, completed: true },
      error: new TodoApiError("network", "offline"),
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides Retry when nothing is left to retry", () => {
    renderBar({
      input: { ids, completed: true },
      error: new TodoApiError("batch_conflict", "conflict", { status: 409, missingIds: ids }),
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "None of the selected todos exist anymore. Nothing was changed.",
    );
    expect(within(alert).queryByRole("button")).toBeNull();
  });
});

describe("TodoSelectionBar, batch delete", () => {
  const ids = ["a", "b", "c"];

  it("names the count and is described by the permanence note", () => {
    renderBar({ selectedCount: 3 });

    const button = screen.getByRole("button", { name: "Delete 3 selected todos" });
    expect(button).toHaveAccessibleDescription("Deleted todos cannot be restored.");
  });

  it("is aria-disabled and ignores clicks when nothing is selected", async () => {
    const props = renderBar({ selectedCount: 0 });

    const button = screen.getByRole("button", { name: "Delete selected todos" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(props.onDeleteSelected).not.toHaveBeenCalled();
  });

  it("calls onDeleteSelected when clicked", async () => {
    const props = renderBar({ selectedCount: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Delete 1 selected todo" }));
    expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("is locked while a batch is pending", async () => {
    const props = renderBar({ selectedCount: 3, isPending: true, deleteInput: { ids } });

    const button = screen.getByRole("button", { name: "Delete 3 selected todos" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    button.focus();
    await userEvent.click(button);
    expect(props.onDeleteSelected).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("shows the pending message in a polite status region", () => {
    renderBar({ selectedCount: 3, isPending: true, deleteInput: { ids } });
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Deleting 3 todos")).toBe(
      true,
    );
  });

  it("shows the result message", () => {
    renderBar({ deleteResult: 1 });
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Deleted 1 todo.")).toBe(
      true,
    );
  });

  it("shows a failure alert with Retry", async () => {
    const props = renderBar({
      selectedCount: 3,
      deleteInput: { ids },
      deleteError: new TodoApiError("http", "boom", { status: 500 }),
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not delete the selected todos. Nothing was deleted.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(props.onRetryDelete).toHaveBeenCalledTimes(1);
    expect(props.onRetry).not.toHaveBeenCalled();
  });

  it("hides Retry when nothing is left to retry", () => {
    renderBar({
      deleteInput: { ids },
      deleteError: new TodoApiError("batch_conflict", "conflict", {
        status: 409,
        missingIds: ids,
      }),
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "None of the selected todos exist anymore. Nothing was deleted.",
    );
    expect(within(alert).queryByRole("button")).toBeNull();
  });
});
