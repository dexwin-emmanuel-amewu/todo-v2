import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../router";

const todos = [
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
];

function listBody(items: typeof todos) {
  return {
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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

function mockFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function renderPage(url = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createAppRouter(history);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, history };
}

function respondByStatus(items: typeof todos) {
  mockFetch().mockImplementation(async (url: string) => {
    if (url.endsWith("status=active")) {
      return jsonResponse(listBody(items.filter((todo) => !todo.completed)));
    }
    if (url.endsWith("status=completed")) {
      return jsonResponse(listBody(items.filter((todo) => todo.completed)));
    }
    return jsonResponse(listBody(items));
  });
}

function requestedUrls() {
  return mockFetch().mock.calls.map(([url]) => url as string);
}

async function filterLink(name: string) {
  const nav = await screen.findByRole("navigation", { name: "Filter todos" });
  return within(nav).getByRole("link", { name });
}

describe("HomePage", () => {
  it("renders the heading", async () => {
    mockFetch().mockResolvedValue(jsonResponse(listBody(todos)));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Todo" })).toBeInTheDocument();
  });

  it("shows loading, then the todos", async () => {
    mockFetch().mockResolvedValue(jsonResponse(listBody(todos)));

    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent(/loading todos/i);

    expect(await screen.findByText("Buy oat milk")).toBeInTheDocument();
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the empty message when the list is empty", async () => {
    mockFetch().mockResolvedValue(jsonResponse(listBody([])));

    renderPage();

    expect(await screen.findByText(/no todos yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows an alert and a retry button when the request fails", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load your todos/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("replaces the alert with the list when retry succeeds", async () => {
    mockFetch()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(jsonResponse(listBody(todos)));

    renderPage();

    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Buy oat milk")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("treats a 500 as a failure rather than an empty list", async () => {
    mockFetch().mockResolvedValue(jsonResponse({ error: { type: "internal" } }, 500));

    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/no todos yet/i)).not.toBeInTheDocument();
  });

  it("creates a todo and refreshes the list", async () => {
    const created = {
      id: "7f3e5d4c-8d3c-4d9c-9d3c-8d3c4d9c8d3c",
      title: "Read a book",
      completed: false,
      createdAt: "2026-09-30T12:00:00.000Z",
    };
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(jsonResponse(created, 201))
      .mockResolvedValueOnce(jsonResponse(listBody([...todos, created])));

    renderPage();
    await screen.findByText("Buy oat milk");
    const input = screen.getByRole("textbox", { name: "Todo title" });
    await userEvent.type(input, "Read a book");
    await userEvent.click(screen.getByRole("button", { name: "Add todo" }));

    expect(await screen.findByText("Todo added.")).toBeInTheDocument();
    expect(await screen.findByText("Read a book")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(mockFetch()).toHaveBeenCalledTimes(3);
    expect(mockFetch().mock.calls[1][1].method).toBe("POST");
    expect(mockFetch().mock.calls[2][1].method).toBe("GET");
  });

  it("patches one todo and refreshes the server-confirmed completion state", async () => {
    const completedTodo = { ...todos[0], completed: true };
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(jsonResponse(completedTodo))
      .mockResolvedValueOnce(jsonResponse(listBody([completedTodo, todos[1]])));

    renderPage();
    await screen.findByText("Buy oat milk");

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }));

    expect(
      await screen.findByRole("checkbox", { name: "Mark Buy oat milk as active" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mark Water the plants as active" })).toBeChecked();
    expect(mockFetch()).toHaveBeenCalledTimes(3);
    expect(mockFetch().mock.calls[1][0]).toBe(`/todos/${todos[0].id}`);
    expect(mockFetch().mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    expect(mockFetch().mock.calls[2][1].method).toBe("GET");
  });

  it("keeps the checkbox unchanged after a failed update and allows retry", async () => {
    const completedTodo = { ...todos[0], completed: true };
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(jsonResponse(completedTodo))
      .mockResolvedValueOnce(jsonResponse(listBody([completedTodo, todos[1]])));

    renderPage();
    await screen.findByText("Buy oat milk");
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
    expect(
      screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }),
    ).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Retry update" }));

    expect(
      await screen.findByRole("checkbox", { name: "Mark Buy oat milk as active" }),
    ).toBeChecked();
    expect(mockFetch()).toHaveBeenCalledTimes(4);
    expect(mockFetch().mock.calls[2][1].body).toBe(JSON.stringify({ completed: true }));
  });

  it("replaces a title with PUT and preserves the todo completion value", async () => {
    const updatedTodo = { ...todos[1], title: "Water the plants indoors" };
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(jsonResponse(updatedTodo))
      .mockResolvedValueOnce(jsonResponse(listBody([todos[0], updatedTodo])));

    renderPage();
    await screen.findByText("Water the plants");

    await userEvent.click(screen.getByRole("button", { name: "Edit Water the plants" }));
    const input = screen.getByRole("textbox", { name: "Edit title for Water the plants" });
    await userEvent.clear(input);
    await userEvent.type(input, "Water the plants indoors");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Water the plants indoors")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Mark Water the plants indoors as active" }),
    ).toBeChecked();
    expect(mockFetch()).toHaveBeenCalledTimes(3);
    expect(mockFetch().mock.calls[1][0]).toBe(`/todos/${todos[1].id}`);
    expect(mockFetch().mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ title: "Water the plants indoors", completed: true }),
    });
    expect(mockFetch().mock.calls[2][1].method).toBe("GET");
  });

  it("deletes one todo with a bodyless DELETE and refreshes the list", async () => {
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(listBody([todos[1]])));

    renderPage();
    await screen.findByText("Buy oat milk");

    await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));

    await waitFor(() => expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument());
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Delete Water the plants" })).toHaveFocus();
    expect(mockFetch()).toHaveBeenCalledTimes(3);
    expect(mockFetch().mock.calls[1][0]).toBe(`/todos/${todos[0].id}`);
    expect(mockFetch().mock.calls[1][1].method).toBe("DELETE");
    expect(mockFetch().mock.calls[1][1].body).toBeUndefined();
    expect(mockFetch().mock.calls[2][1].method).toBe("GET");
  });

  it("keeps the row after a failed delete and allows retry", async () => {
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(listBody([todos[1]])));

    renderPage();
    await screen.findByText("Buy oat milk");
    await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not delete this todo/i);
    expect(screen.getByText("Buy oat milk")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry delete" }));

    await waitFor(() => expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument());
    expect(mockFetch()).toHaveBeenCalledTimes(4);
  });

  it("refreshes the list after a 404 and removes the stale row", async () => {
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(listBody(todos)))
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse(listBody([todos[1]])));

    renderPage();
    await screen.findByText("Buy oat milk");
    await userEvent.click(screen.getByRole("button", { name: "Delete Buy oat milk" }));

    await waitFor(() => expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument());
    expect(mockFetch().mock.calls[2][1].method).toBe("GET");
  });

  describe("status filter", () => {
    it("selects All and requests the unfiltered list on the default URL", async () => {
      respondByStatus(todos);

      renderPage("/");

      expect(await screen.findByText("2 todos")).toBeInTheDocument();
      expect(await filterLink("All")).toHaveAttribute("aria-current", "page");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("selects the filter from the URL and requests it from the server", async () => {
      respondByStatus(todos);

      renderPage("/?status=completed");

      expect(await screen.findByText("Water the plants")).toBeInTheDocument();
      expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument();
      expect(screen.getByText("1 completed todo")).toBeInTheDocument();
      expect(await filterLink("Completed")).toHaveAttribute("aria-current", "page");
      expect(await filterLink("All")).not.toHaveAttribute("aria-current");
      expect(requestedUrls()).toEqual(["/todos?status=completed"]);
    });

    it("falls back to All and replaces a bad status in the URL", async () => {
      respondByStatus(todos);

      const { router } = renderPage("/?status=done");

      expect(await screen.findByText("2 todos")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/");
      expect(await filterLink("All")).toHaveAttribute("aria-current", "page");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("keeps a good status and drops unknown search params", async () => {
      respondByStatus(todos);

      const { router } = renderPage("/?status=active&page=2");

      expect(await screen.findByText("1 active todo")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?status=active");
      expect(requestedUrls()).toEqual(["/todos?status=active"]);
    });

    it("loads the chosen filter without showing rows from the previous filter", async () => {
      let resolveActive: (response: Response) => void = () => {};
      mockFetch()
        .mockResolvedValueOnce(jsonResponse(listBody(todos)))
        .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveActive = resolve)));

      const { router } = renderPage("/");
      await screen.findByText("Water the plants");

      await userEvent.click(await filterLink("Active"));

      expect(router.state.location.href).toBe("/?status=active");
      expect(await screen.findByRole("status")).toHaveTextContent(/loading todos/i);
      expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
      expect(screen.queryByText("Buy oat milk")).not.toBeInTheDocument();
      expect(screen.queryByText("2 todos")).not.toBeInTheDocument();

      resolveActive(jsonResponse(listBody([todos[0]])));

      expect(await screen.findByText("Buy oat milk")).toBeInTheDocument();
      expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
      expect(screen.getByText("1 active todo")).toBeInTheDocument();
      expect(await filterLink("Active")).toHaveAttribute("aria-current", "page");
      expect(requestedUrls()).toEqual(["/todos", "/todos?status=active"]);
    });

    it("restores the earlier filter from history", async () => {
      respondByStatus(todos);
      const { history, router } = renderPage("/");
      await screen.findByText("2 todos");

      await userEvent.click(await filterLink("Completed"));
      await screen.findByText("1 completed todo");

      history.back();

      await waitFor(() => expect(router.state.location.href).toBe("/"));
      expect(await screen.findByText("2 todos")).toBeInTheDocument();
      expect(await filterLink("All")).toHaveAttribute("aria-current", "page");
    });

    it("removes a todo from the Active view once it is completed", async () => {
      const completedTodo = { ...todos[0], completed: true };
      mockFetch()
        .mockResolvedValueOnce(jsonResponse(listBody([todos[0]])))
        .mockResolvedValueOnce(jsonResponse(completedTodo))
        .mockResolvedValueOnce(jsonResponse(listBody([])));

      renderPage("/?status=active");
      await screen.findByText("Buy oat milk");

      await userEvent.click(
        screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }),
      );

      expect(await screen.findByRole("heading", { name: "No active todos." })).toBeInTheDocument();
      expect(requestedUrls()[2]).toBe("/todos?status=active");
    });
  });
});
