import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, TodoSearch } from "./TodoSearch";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(value?: string) {
  const onCommit = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<TodoSearch value={value} onCommit={onCommit} />);
  const box = () => screen.getByRole("searchbox", { name: "Search todos" });
  return { onCommit, user, box, ...view };
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("TodoSearch", () => {
  it("is a labelled search form", () => {
    setup();

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search todos")).toBeInTheDocument();
  });

  it("starts with the committed value", () => {
    const { box } = setup("milk");

    expect(box()).toHaveValue("milk");
  });

  it("commits once, after the last keystroke", async () => {
    const { onCommit, user, box } = setup();

    await user.type(box(), "milk");
    expect(onCommit).not.toHaveBeenCalled();

    // Real time also moves the fake clock, so stay well short of the delay.
    wait(SEARCH_DEBOUNCE_MS / 2);
    expect(onCommit).not.toHaveBeenCalled();

    wait(SEARCH_DEBOUNCE_MS / 2 + 50);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("milk");
  });

  it("commits the trimmed text", async () => {
    const { onCommit, user, box } = setup();

    await user.type(box(), "  milk  ");
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).toHaveBeenCalledWith("milk");
  });

  it("commits at once on Enter and does not commit again after the delay", async () => {
    const { onCommit, user, box } = setup();

    await user.type(box(), "milk{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);

    wait(SEARCH_DEBOUNCE_MS * 2);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits no search for blank text", async () => {
    const { onCommit, user, box } = setup("milk");

    await user.clear(box());
    await user.type(box(), "   ");
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).toHaveBeenLastCalledWith(undefined);
  });

  it("does not commit a search that is already committed", async () => {
    const { onCommit, user, box } = setup("milk");

    await user.type(box(), " ");
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows a message and commits nothing for text over 100 characters", async () => {
    const { onCommit, user, box } = setup();

    await user.click(box());
    await user.paste("a".repeat(101));
    await user.keyboard("{Enter}");
    wait(SEARCH_DEBOUNCE_MS);

    expect(screen.getByText("Search must be 100 characters or fewer.")).toBeInTheDocument();
    expect(box()).toHaveAttribute("aria-invalid", "true");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("accepts exactly 100 characters", async () => {
    const { onCommit, user, box } = setup();

    await user.click(box());
    await user.paste("a".repeat(100));
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).toHaveBeenCalledWith("a".repeat(100));
    expect(screen.queryByText("Search must be 100 characters or fewer.")).not.toBeInTheDocument();
  });

  it("hides the Clear button when the box is empty", () => {
    setup();

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("clears the box, commits no search at once, and focuses the box", async () => {
    const { onCommit, user, box } = setup("milk");

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(box()).toHaveValue("");
    expect(onCommit).toHaveBeenCalledWith(undefined);
    expect(box()).toHaveFocus();
  });

  it("clears on Escape", async () => {
    const { onCommit, user, box } = setup("milk");

    await user.click(box());
    await user.keyboard("{Escape}");

    expect(box()).toHaveValue("");
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("cancels a pending commit when cleared", async () => {
    const { onCommit, user, box } = setup();

    await user.type(box(), "milk");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).not.toHaveBeenCalledWith("milk");
  });

  it("follows the URL value when it changes", () => {
    const { rerender, box, onCommit } = setup("milk");

    rerender(<TodoSearch value="plants" onCommit={onCommit} />);
    expect(box()).toHaveValue("plants");

    rerender(<TodoSearch value={undefined} onCommit={onCommit} />);
    expect(box()).toHaveValue("");
  });

  it("does not commit after it unmounts", async () => {
    const { onCommit, user, box, unmount } = setup();

    await user.type(box(), "milk");
    unmount();
    wait(SEARCH_DEBOUNCE_MS);

    expect(onCommit).not.toHaveBeenCalled();
  });
});
