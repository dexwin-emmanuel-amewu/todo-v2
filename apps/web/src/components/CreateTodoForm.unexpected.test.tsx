import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateTodoForm } from "./CreateTodoForm";

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("../hooks/useCreateTodoMutation", () => ({
  useCreateTodoMutation: () => ({ isPending: false, mutateAsync }),
}));

describe("CreateTodoForm unexpected errors", () => {
  it("shows a safe message and preserves the title when the mutation throws unexpectedly", async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValueOnce(new Error("unexpected internal detail"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<CreateTodoForm />);
    const input = screen.getByRole("textbox", { name: "Todo title" });
    await user.type(input, "Buy oat milk");
    await user.click(screen.getByRole("button", { name: "Add todo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Your todo was not added. Try again.",
    );
    expect(input).toHaveValue("Buy oat milk");
    expect(errorSpy).toHaveBeenCalledWith(
      "Unexpected error while creating a todo",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
