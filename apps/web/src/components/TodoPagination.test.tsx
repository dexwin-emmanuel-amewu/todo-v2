import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TodoPagination } from "./TodoPagination";

type Props = Parameters<typeof TodoPagination>[0];

function renderBar(props: Partial<Props> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <TodoPagination
      page={2}
      pageSize={20}
      totalItems={87}
      totalPages={5}
      itemCount={20}
      isLoading={false}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...props}
    />,
  );
  return { onPageChange, onPageSizeChange };
}

const previous = () => screen.getByRole("button", { name: "Previous page" });
const next = () => screen.getByRole("button", { name: "Next page" });

describe("TodoPagination", () => {
  it("shows the page and the range from the response", () => {
    renderBar();

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 5. Showing 21 to 40 of 87")).toBeInTheDocument();
  });

  it("shows a short last page range", () => {
    renderBar({ page: 5, itemCount: 7 });

    expect(screen.getByText("Page 5 of 5. Showing 81 to 87 of 87")).toBeInTheDocument();
  });

  it("moves to the next and the previous page", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderBar();

    await user.click(next());
    await user.click(previous());

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables Previous on the first page and ignores its clicks", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderBar({ page: 1 });

    expect(previous()).toHaveAttribute("aria-disabled", "true");
    expect(next()).toHaveAttribute("aria-disabled", "false");
    await user.click(previous());

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("disables Next on the last page and ignores its clicks", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderBar({ page: 5 });

    expect(next()).toHaveAttribute("aria-disabled", "true");
    await user.click(next());

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("lists the page sizes, shows the current one, and reports a number", async () => {
    const user = userEvent.setup();
    const { onPageSizeChange } = renderBar({ pageSize: 20 });
    const select = screen.getByRole("combobox", { name: "Todos per page" });

    expect(select).toHaveValue("20");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10",
      "20",
      "50",
      "100",
    ]);
    await user.selectOptions(select, "50");

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("renders nothing for an empty list or 10 todos or fewer", () => {
    const { container } = render(
      <TodoPagination
        page={1}
        pageSize={20}
        totalItems={10}
        totalPages={1}
        itemCount={10}
        isLoading={false}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("disables both buttons and hides the range while a page loads", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderBar({ isLoading: true });

    expect(previous()).toHaveAttribute("aria-disabled", "true");
    expect(next()).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    await user.click(next());

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("announces the page only when it is ready", () => {
    renderBar();

    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 5");
  });

  it("keeps the status silent while loading", () => {
    renderBar({ isLoading: true });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps focus on Next after it is pressed, also when it becomes disabled", async () => {
    const user = userEvent.setup();
    renderBar({ page: 4 });

    await user.click(next());
    expect(next()).toHaveFocus();
  });

  it("can be reached and used with the keyboard", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderBar();

    await user.tab();
    expect(previous()).toHaveFocus();
    await user.tab();
    expect(next()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
