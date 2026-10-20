import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTodoForm } from "./CreateTodoForm";

const todo = {
  id: "5d1c3b2a-6b1a-4b9a-9b1a-6b1a4b9a9b1a",
  title: "Buy oat milk",
  completed: false,
  createdAt: "2026-09-30T10:00:00.000Z",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return render(<CreateTodoForm />, { wrapper: Wrapper });
}

function mockFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("CreateTodoForm", () => {
  it("validates locally and focuses the title input without making a request", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByRole("textbox", { name: "Todo title" });

    await user.click(screen.getByRole("button", { name: "Add todo" }));
    expect(await screen.findByText("Enter a todo title.")).toBeInTheDocument();

    await user.type(input, "abc");
    await user.click(screen.getByRole("button", { name: "Add todo" }));

    expect(await screen.findByText("Use at least 6 characters.")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("trims the title, blocks repeated submissions, then clears and restores focus on success", async () => {
    const user = userEvent.setup();
    let resolveRequest!: (response: Response) => void;
    mockFetch().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderForm();
    const input = screen.getByRole("textbox", { name: "Todo title" });
    await user.type(input, "  Buy oat milk  ");

    const button = screen.getByRole("button", { name: "Add todo" });
    await user.click(button);
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    expect(mockFetch()).toHaveBeenCalledTimes(1);
    expect(mockFetch().mock.calls[0][1].body).toBe(JSON.stringify({ title: "Buy oat milk" }));

    resolveRequest(jsonResponse(todo));
    expect(await screen.findByText("Todo added.")).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue(""));
    expect(input).toHaveFocus();
    expect(mockFetch()).toHaveBeenCalledTimes(1);
  });

  it("keeps the title and shows a useful message after an API failure", async () => {
    const user = userEvent.setup();
    mockFetch().mockRejectedValue(new TypeError("offline"));
    renderForm();
    const input = screen.getByRole("textbox", { name: "Todo title" });
    await user.type(input, "Buy oat milk");
    await user.click(screen.getByRole("button", { name: "Add todo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Check your connection and try again.",
    );
    expect(input).toHaveValue("Buy oat milk");
    expect(screen.getByRole("button", { name: "Add todo" })).toBeEnabled();
  });
});
