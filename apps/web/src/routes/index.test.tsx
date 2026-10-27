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

    it("keeps the previous rows, disabled, and hides the count while the chosen filter loads", async () => {
      let resolveActive: (response: Response) => void = () => {};
      mockFetch()
        .mockResolvedValueOnce(jsonResponse(listBody(todos)))
        .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveActive = resolve)));

      const { router } = renderPage("/");
      await screen.findByText("Water the plants");

      await userEvent.click(await filterLink("Active"));

      expect(router.state.location.href).toBe("/?status=active");
      expect(await screen.findByRole("status")).toHaveTextContent(/updating results/i);
      expect(screen.getByText("Water the plants")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Buy oat milk/ })).toBeDisabled();
      expect(screen.queryByText("2 todos")).not.toBeInTheDocument();

      resolveActive(jsonResponse(listBody([todos[0]])));

      expect(await screen.findByText("1 active todo")).toBeInTheDocument();
      expect(screen.getByText("Buy oat milk")).toBeInTheDocument();
      expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
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

  describe("search", () => {
    const searchBox = () => screen.getByRole("searchbox", { name: "Search todos" });

    function respondBySearch(items: typeof todos) {
      mockFetch().mockImplementation(async (url: string) => {
        const params = new URL(url, "http://localhost").searchParams;
        const search = params.get("search")?.toLowerCase();
        const status = params.get("status");
        const matches = items.filter(
          (todo) =>
            (!search || todo.title.toLowerCase().includes(search)) &&
            (status === null || (status === "completed") === todo.completed),
        );
        return jsonResponse(listBody(matches));
      });
    }

    it("shows an empty box and requests no search on the plain URL", async () => {
      respondBySearch(todos);

      renderPage("/");

      await screen.findByText("2 todos");
      expect(searchBox()).toHaveValue("");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("fills the box from the URL and sends the search to the server", async () => {
      respondBySearch(todos);

      renderPage("/?search=milk");

      expect(await screen.findByText('1 todo matching "milk"')).toBeInTheDocument();
      expect(searchBox()).toHaveValue("milk");
      expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
      expect(requestedUrls()).toEqual(["/todos?search=milk"]);
    });

    it("commits a typed search to the URL and sends one request for it", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/");
      await screen.findByText("2 todos");

      await userEvent.type(searchBox(), "milk");

      expect(await screen.findByText('1 todo matching "milk"')).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?search=milk");
      expect(requestedUrls()).toEqual(["/todos", "/todos?search=milk"]);
    });

    it("combines the search with the status, and keeps the search when the status changes", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?search=a");
      await screen.findByText('2 todos matching "a"');

      await userEvent.click(await filterLink("Active"));

      expect(await screen.findByText('1 active todo matching "a"')).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?status=active&search=a");
      expect(requestedUrls().at(-1)).toBe("/todos?status=active&search=a");
    });

    it("keeps the status when the search changes", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?status=completed");
      await screen.findByText("1 completed todo");

      await userEvent.type(searchBox(), "water{Enter}");

      expect(await screen.findByText('1 completed todo matching "water"')).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?status=completed&search=water");
    });

    it("drops a page param when the search changes", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?search=a&page=3");
      await screen.findByText('2 todos matching "a"');
      expect(router.state.location.href).toBe("/?search=a");

      await userEvent.clear(searchBox());
      await userEvent.type(searchBox(), "milk{Enter}");

      await waitFor(() => expect(router.state.location.href).toBe("/?search=milk"));
      expect(requestedUrls().every((url) => !url.includes("page"))).toBe(true);
    });

    it("shows a no results message with a way to clear the search", async () => {
      respondBySearch(todos);
      renderPage("/?search=zzz");

      expect(
        await screen.findByRole("heading", { name: 'No todos match "zzz".' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("restores the unsearched list when the search is cleared", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?status=active&search=milk");
      await screen.findByText('1 active todo matching "milk"');

      await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

      expect(await screen.findByText("1 active todo")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?status=active");
      expect(searchBox()).toHaveValue("");
      expect(searchBox()).toHaveFocus();
      expect(requestedUrls().at(-1)).toBe("/todos?status=active");
    });

    it("clears from the no results message and focuses the box", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?search=zzz");
      await screen.findByRole("heading", { name: 'No todos match "zzz".' });

      await userEvent.click(screen.getAllByRole("button", { name: /clear search/i })[1]);

      expect(await screen.findByText("2 todos")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/");
      expect(searchBox()).toHaveFocus();
    });

    it("sends nothing for a blank search", async () => {
      respondBySearch(todos);
      const { router } = renderPage("/?search=%20%20");

      await screen.findByText("2 todos");

      expect(router.state.location.href).toBe("/");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("drops a search over 100 characters from the URL and sends no request for it", async () => {
      respondBySearch(todos);
      const { router } = renderPage(`/?search=${"a".repeat(101)}`);

      await screen.findByText("2 todos");

      expect(router.state.location.href).toBe("/");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("shows a message and sends no request for a typed search over 100 characters", async () => {
      respondBySearch(todos);
      renderPage("/");
      await screen.findByText("2 todos");

      await userEvent.click(searchBox());
      await userEvent.paste("a".repeat(101));
      await userEvent.keyboard("{Enter}");

      expect(
        await screen.findByText("Search must be 100 characters or fewer."),
      ).toBeInTheDocument();
      expect(screen.getByText("Water the plants")).toBeInTheDocument();
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("keeps a numeric search as text without redirect loops", async () => {
      respondBySearch(todos);
      renderPage("/?search=123");

      expect(await screen.findByText('No todos match "123".')).toBeInTheDocument();
      expect(searchBox()).toHaveValue("123");
      expect(requestedUrls()).toEqual(["/todos?search=123"]);
    });

    it("restores the earlier search and box text from history", async () => {
      respondBySearch(todos);
      const { history, router } = renderPage("/");
      await screen.findByText("2 todos");
      await userEvent.type(searchBox(), "milk{Enter}");
      await screen.findByText('1 todo matching "milk"');
      await userEvent.click(await filterLink("Active"));
      await screen.findByText('1 active todo matching "milk"');

      history.back();

      await waitFor(() => expect(router.state.location.href).toBe("/?search=milk"));
      expect(searchBox()).toHaveValue("milk");
    });

    it("shows the retry alert and keeps the typed text when the search request fails", async () => {
      mockFetch()
        .mockResolvedValueOnce(jsonResponse(listBody(todos)))
        .mockResolvedValueOnce(jsonResponse({ error: { type: "internal" } }, 500))
        .mockResolvedValueOnce(jsonResponse(listBody([todos[0]])));
      renderPage("/");
      await screen.findByText("2 todos");

      await userEvent.type(searchBox(), "milk{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your todos.");
      expect(searchBox()).toHaveValue("milk");

      await userEvent.click(screen.getByRole("button", { name: /retry/i }));

      expect(await screen.findByText('1 todo matching "milk"')).toBeInTheDocument();
      expect(requestedUrls().at(-1)).toBe("/todos?search=milk");
    });

    it("removes a todo from a searched Active view once it is completed", async () => {
      const completedTodo = { ...todos[0], completed: true };
      mockFetch()
        .mockResolvedValueOnce(jsonResponse(listBody([todos[0]])))
        .mockResolvedValueOnce(jsonResponse(completedTodo))
        .mockResolvedValueOnce(jsonResponse(listBody([])));
      renderPage("/?status=active&search=milk");
      await screen.findByText("Buy oat milk");

      await userEvent.click(
        screen.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }),
      );

      expect(
        await screen.findByRole("heading", { name: 'No active todos match "milk".' }),
      ).toBeInTheDocument();
      expect(requestedUrls()[2]).toBe("/todos?status=active&search=milk");
    });
  });
});
