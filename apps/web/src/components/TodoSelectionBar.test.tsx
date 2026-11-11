import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

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

  it("keeps the count and the notice in separate polite regions", () => {
    renderBar({ selectedCount: 3, notice: "limit" });
    const regions = screen.getAllByRole("status");
    expect(regions).toHaveLength(2);
    for (const region of regions) expect(region).toHaveAttribute("aria-live", "polite");
    expect(regions[0]).toHaveTextContent("3 selected");
    expect(regions[1]).toHaveTextContent(
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
