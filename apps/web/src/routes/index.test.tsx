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
let apiFetch: ReturnType<typeof vi.fn>;
let summaryFetch: ReturnType<typeof vi.fn>;

// The toggle-all summary reads `GET /todos?pageSize=1` and `GET /todos?status=active&pageSize=1`.
function isSummaryRequest(url: string) {
  return /[?&]pageSize=1(&|$)/.test(url);
}

function summaryBody(totalItems: number) {
  return { items: [], page: 1, pageSize: 1, totalItems, totalPages: totalItems };
}

beforeEach(() => {
  apiFetch = vi.fn();
  summaryFetch = vi.fn(async () => jsonResponse(summaryBody(0)));
  globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
    const target = (isSummaryRequest(url) ? summaryFetch : apiFetch) as unknown as typeof fetch;
    return target(url, init);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch() {
  return apiFetch;
}

function summaryUrls() {
  return summaryFetch.mock.calls.map(([url]) => url as string);
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
  return { router, history, queryClient };
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

type ServerTodo = (typeof todos)[number];

function makeTodos(count: number, isCompleted: (index: number) => boolean): ServerTodo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Todo number ${index + 1}`,
    completed: isCompleted(index),
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
  }));
}

// A small in-memory server for GET /todos, PATCH /todos, and DELETE /todos?status=completed.
function fakeServer(initial: ServerTodo[]) {
  const state = { items: initial.map((todo) => ({ ...todo })) };
  const patchBodies: unknown[] = [];
  const deleteUrls: string[] = [];
  let patchOverride: (() => Promise<Response>) | undefined;
  let deleteOverride: (() => Promise<Response>) | undefined;

  async function handle(url: string, init?: RequestInit): Promise<Response> {
    if (init?.method === "PATCH" && url === "/todos") {
      const body = JSON.parse(String(init.body)) as { completed: boolean };
      patchBodies.push(body);
      if (patchOverride) return patchOverride();
      const changed = state.items.filter((todo) => todo.completed !== body.completed);
      for (const todo of changed) todo.completed = body.completed;
      return jsonResponse({ updatedCount: changed.length });
    }

    if (init?.method === "DELETE" && url.startsWith("/todos?")) {
      deleteUrls.push(url);
      if (deleteOverride) return deleteOverride();
      const before = state.items.length;
      state.items = state.items.filter((todo) => !todo.completed);
      return jsonResponse({ deletedCount: before - state.items.length });
    }

    const params = new URL(url, "http://test").searchParams;
    const status = params.get("status");
    const page = Number(params.get("page") ?? 1);
    const pageSize = Number(params.get("pageSize") ?? 20);
    const matching = state.items.filter((todo) =>
      status === "active" ? !todo.completed : status === "completed" ? todo.completed : true,
    );
    return jsonResponse({
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems: matching.length,
      totalPages: matching.length === 0 ? 0 : Math.ceil(matching.length / pageSize),
    });
  }

  mockFetch().mockImplementation(handle);
  summaryFetch.mockImplementation(handle);

  return {
    state,
    handle,
    patchBodies,
    failPatchWith(response: () => Promise<Response>) {
      patchOverride = response;
    },
    restorePatch() {
      patchOverride = undefined;
    },
    deleteUrls,
    failDeleteWith(response: () => Promise<Response>) {
      deleteOverride = response;
    },
    restoreDelete() {
      deleteOverride = undefined;
    },
  };
}

function listGetCount() {
  return mockFetch().mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET").length;
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

      const { router } = renderPage("/?status=active&unknown=2");

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
      expect(await screen.findByText(/updating results/i)).toHaveAttribute("role", "status");
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

  describe("pagination", () => {
    // Task 1..total, in order. Even numbers are completed. The mock honours the page parameters.
    function respondByPage(getTotal: () => number) {
      const handler = async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        const params = new URL(url, "http://localhost").searchParams;
        const page = Number(params.get("page") ?? 1);
        const pageSize = Number(params.get("pageSize") ?? 20);
        const search = params.get("search")?.toLowerCase();
        const status = params.get("status");
        const all = Array.from({ length: getTotal() }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          title: `Task ${index + 1}`,
          completed: (index + 1) % 2 === 0,
          createdAt: "2026-09-30T10:00:00.000Z",
        })).filter(
          (todo) =>
            (!search || todo.title.toLowerCase().includes(search)) &&
            (status === null || (status === "completed") === todo.completed),
        );
        return jsonResponse({
          items: all.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalItems: all.length,
          totalPages: all.length === 0 ? 0 : Math.ceil(all.length / pageSize),
        });
      };
      mockFetch().mockImplementation(handler);
      return handler;
    }

    const searchBox = () => screen.getByRole("searchbox", { name: "Search todos" });

    const pagination = () => screen.findByRole("navigation", { name: "Pagination" });
    const nextButton = () => screen.getByRole("button", { name: "Next page" });
    const previousButton = () => screen.getByRole("button", { name: "Previous page" });
    const pageSizeSelect = () => screen.getByRole("combobox", { name: "Todos per page" });

    it("loads page 1 with no page parameters and shows the metadata", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/");

      expect(await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeInTheDocument();
      expect(requestedUrls()).toEqual(["/todos"]);
      expect(router.state.location.href).toBe("/");
      expect(previousButton()).toHaveAttribute("aria-disabled", "true");
      expect(nextButton()).toHaveAttribute("aria-disabled", "false");
    });

    it("requests the page and page size from the URL", async () => {
      respondByPage(() => 45);
      renderPage("/?page=2&pageSize=10");

      expect(await screen.findByText("Page 2 of 5. Showing 11 to 20 of 45")).toBeInTheDocument();
      expect(requestedUrls()).toEqual(["/todos?page=2&pageSize=10"]);
      expect(pageSizeSelect()).toHaveValue("10");
    });

    it("moves to the next page and back, and keeps focus on the button", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/");
      await pagination();

      await userEvent.click(nextButton());

      expect(await screen.findByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?page=2");
      expect(screen.getByText("Task 21")).toBeInTheDocument();
      expect(nextButton()).toHaveFocus();

      await userEvent.click(previousButton());

      expect(await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/");
    });

    it("disables Next on the last page", async () => {
      respondByPage(() => 45);
      renderPage("/?page=3");

      expect(await screen.findByText("Page 3 of 3. Showing 41 to 45 of 45")).toBeInTheDocument();
      expect(nextButton()).toHaveAttribute("aria-disabled", "true");
    });

    it("restores the earlier page with browser back", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/");
      await pagination();
      await userEvent.click(nextButton());
      await screen.findByText("Page 2 of 3. Showing 21 to 40 of 45");

      router.history.back();

      expect(await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/");
    });

    it("changes the page size, drops the page, and keeps the status and search", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?search=task&page=2");
      await screen.findByText("Page 2 of 3. Showing 21 to 40 of 45");

      await userEvent.selectOptions(pageSizeSelect(), "10");

      expect(await screen.findByText("Page 1 of 5. Showing 1 to 10 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?search=task&pageSize=10");
      expect(pageSizeSelect()).toHaveFocus();

      await userEvent.selectOptions(pageSizeSelect(), "20");

      await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45");
      expect(router.state.location.href).toBe("/?search=task");
    });

    it("resets to page 1 and keeps the page size when the status changes", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=2&pageSize=10");
      await screen.findByText("Page 2 of 5. Showing 11 to 20 of 45");

      await userEvent.click(await filterLink("Active"));

      expect(await screen.findByText("Page 1 of 3. Showing 1 to 10 of 23")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?status=active&pageSize=10");
      expect(requestedUrls().at(-1)).toBe("/todos?status=active&pageSize=10");
    });

    it("resets to page 1 and keeps the page size when the search changes", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=2&pageSize=10");
      await screen.findByText("Page 2 of 5. Showing 11 to 20 of 45");

      await userEvent.type(searchBox(), "task 1{Enter}");

      await waitFor(() => expect(router.state.location.href).toBe("/?search=task+1&pageSize=10"));
      expect(requestedUrls().at(-1)).toBe("/todos?search=task+1&pageSize=10");
    });

    it("drops bad page and page size values and replaces the URL", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=abc&pageSize=7");

      await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45");

      expect(router.state.location.href).toBe("/");
      expect(requestedUrls()).toEqual(["/todos"]);
    });

    it("drops the default page and page size", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=1&pageSize=20");

      await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45");

      expect(router.state.location.href).toBe("/");
    });

    it("rewrites a zero padded page without looping", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=02");

      expect(await screen.findByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?page=2");
    });

    it("moves a page past the end to the last page without showing an empty message", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=9");

      expect(await screen.findByText("Page 3 of 3. Showing 41 to 45 of 45")).toBeInTheDocument();
      expect(router.state.location.href).toBe("/?page=3");
      expect(screen.queryByText(/no todos/i)).not.toBeInTheDocument();
      expect(requestedUrls()).toEqual(["/todos?page=9", "/todos?page=3"]);
    });

    it("does not return to the missing page with browser back", async () => {
      respondByPage(() => 45);
      const { router } = renderPage("/?page=9");
      await screen.findByText("Page 3 of 3. Showing 41 to 45 of 45");

      expect(router.history.length).toBe(1);
    });

    it("moves an empty list with a page to page 1 and shows the empty message", async () => {
      respondByPage(() => 0);
      const { router } = renderPage("/?page=3");

      expect(await screen.findByText(/no todos yet/i)).toBeInTheDocument();
      expect(router.state.location.href).toBe("/");
      expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    });

    it("hides the bar for 10 todos or fewer", async () => {
      respondByPage(() => 10);
      renderPage("/");

      expect(await screen.findByText("10 todos")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    });

    it("keeps the old page, disables both buttons, and hides the range while a page loads", async () => {
      let resolvePage: (response: Response) => void = () => {};
      const respond = respondByPage(() => 45);
      mockFetch()
        .mockImplementationOnce(respond)
        .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolvePage = resolve)));
      renderPage("/");
      await screen.findByText("Page 1 of 3. Showing 1 to 20 of 45");

      await userEvent.click(nextButton());

      expect(await screen.findByText("Updating results")).toBeInTheDocument();
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(previousButton()).toHaveAttribute("aria-disabled", "true");
      expect(nextButton()).toHaveAttribute("aria-disabled", "true");
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();

      resolvePage(await respond("/todos?page=2"));

      expect(await screen.findByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeInTheDocument();
    });

    it("moves to the new last page when the only todo on the last page is deleted", async () => {
      let total = 21;
      respondByPage(() => total);
      const { router } = renderPage("/?page=2");
      await screen.findByText("Page 2 of 2. Showing 21 to 21 of 21");

      total = 20;
      await userEvent.click(screen.getByRole("button", { name: "Delete Task 21" }));

      expect(await screen.findByText("Task 20")).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.href).toBe("/"));
      expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the alert with retry and no bar when the page fails to load", async () => {
      mockFetch()
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse(listBody(todos)));
      renderPage("/?page=2");

      expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your todos.");
      expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /retry/i }));

      await waitFor(() =>
        expect(requestedUrls().slice(0, 2)).toEqual(["/todos?page=2", "/todos?page=2"]),
      );
    });
  });

  describe("toggle all", () => {
    it("reads the whole collection and marks every todo completed", async () => {
      const server = fakeServer(makeTodos(12, (index) => index >= 3));

      renderPage();

      const checkbox = await screen.findByRole("checkbox", {
        name: "Mark all 12 todos as completed",
      });
      expect(checkbox).not.toBeChecked();
      expect(summaryUrls()).toEqual(
        expect.arrayContaining(["/todos?pageSize=1", "/todos?status=active&pageSize=1"]),
      );
      expect(
        screen.queryByText("Applies to all todos, not only this view."),
      ).not.toBeInTheDocument();
      const listGetsBefore = listGetCount();

      await userEvent.click(checkbox);

      expect(
        await screen.findByRole("checkbox", { name: "Mark all 12 todos as active" }),
      ).toBeChecked();
      expect(server.patchBodies).toEqual([{ completed: true }]);
      const patchCall = mockFetch().mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall?.[0]).toBe("/todos");
      expect(patchCall?.[1]).toMatchObject({ body: JSON.stringify({ completed: true }) });
      expect(await screen.findByText("Marked 3 todos as completed.")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Mark all 12 todos as active" })).toHaveFocus();
      expect(screen.getByRole("checkbox", { name: "Mark Todo number 1 as active" })).toBeChecked();
      expect(listGetCount()).toBeGreaterThan(listGetsBefore);
      expect(screen.getByText("12 todos")).toBeInTheDocument();
    });

    it("marks every todo active when every todo is completed", async () => {
      const server = fakeServer(makeTodos(3, () => true));

      renderPage();

      const checkbox = await screen.findByRole("checkbox", { name: "Mark all 3 todos as active" });
      expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);

      expect(
        await screen.findByRole("checkbox", { name: "Mark all 3 todos as completed" }),
      ).not.toBeChecked();
      expect(server.patchBodies).toEqual([{ completed: false }]);
      expect(await screen.findByText("Marked 3 todos as active.")).toBeInTheDocument();
    });

    it("follows the whole collection on a filtered view and shows the scope note", async () => {
      fakeServer(makeTodos(12, (index) => index >= 3));

      renderPage("/?status=completed");

      const checkbox = await screen.findByRole("checkbox", {
        name: "Mark all 12 todos as completed",
      });
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toHaveAccessibleDescription("Applies to all todos, not only this view.");
      expect(await screen.findByText("9 completed todos")).toBeInTheDocument();
    });

    it("follows the whole collection across pages", async () => {
      fakeServer(makeTodos(25, (index) => index >= 20));

      renderPage("/?page=2");

      expect(await screen.findByText("Todo number 21")).toBeInTheDocument();
      expect(
        await screen.findByRole("checkbox", { name: "Mark all 25 todos as completed" }),
      ).not.toBeChecked();
    });

    it("empties the Active view after marking every todo completed", async () => {
      fakeServer(makeTodos(4, (index) => index === 0));

      renderPage("/?status=active");

      await screen.findByText("Todo number 2");
      await userEvent.click(
        await screen.findByRole("checkbox", { name: "Mark all 4 todos as completed" }),
      );

      expect(await screen.findByText("No active todos.")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Mark all 4 todos as active" })).toBeChecked();
    });

    it("locks the control and the rows while the request is pending", async () => {
      const server = fakeServer(makeTodos(3, () => false));
      let release: () => void = () => {};
      server.failPatchWith(
        () =>
          new Promise((resolve) => {
            release = () => resolve(jsonResponse({ updatedCount: 3 }));
          }),
      );

      renderPage();
      const checkbox = await screen.findByRole("checkbox", {
        name: "Mark all 3 todos as completed",
      });
      await userEvent.dblClick(checkbox);

      expect(await screen.findByText("Marking all todos as completed")).toBeInTheDocument();
      expect(checkbox).toHaveAttribute("aria-disabled", "true");
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toHaveFocus();
      expect(
        screen.getByRole("checkbox", { name: "Mark Todo number 1 as completed" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete Todo number 1" })).toBeDisabled();
      expect(server.patchBodies).toHaveLength(1);

      release();
      expect(await screen.findByText("Marked 3 todos as completed.")).toBeInTheDocument();
      expect(server.patchBodies).toHaveLength(1);
    });

    it("shows an alert on failure, refreshes the list, and retries the same value", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      server.failPatchWith(async () => jsonResponse({ error: { type: "internal" } }, 500));

      renderPage();
      const checkbox = await screen.findByRole("checkbox", {
        name: "Mark all 3 todos as completed",
      });
      const listGetsBefore = listGetCount();
      await userEvent.click(checkbox);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("The server could not update your todos. Try again.");
      expect(checkbox).not.toBeChecked();
      await waitFor(() => expect(listGetCount()).toBeGreaterThan(listGetsBefore));
      expect(
        screen.getByRole("checkbox", { name: "Mark Todo number 2 as completed" }),
      ).toBeEnabled();

      server.restorePatch();
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

      expect(
        await screen.findByRole("checkbox", { name: "Mark all 3 todos as active" }),
      ).toBeChecked();
      expect(server.patchBodies).toEqual([{ completed: true }, { completed: true }]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is hidden on an empty collection", async () => {
      fakeServer([]);

      renderPage();

      expect(await screen.findByText(/no todos yet/i)).toBeInTheDocument();
      await waitFor(() => expect(summaryFetch).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("is hidden when the summary fails and the list still works", async () => {
      fakeServer(makeTodos(3, () => false));
      summaryFetch.mockResolvedValue(jsonResponse({ error: { type: "internal" } }, 500));

      renderPage();

      expect(await screen.findByText("Todo number 1")).toBeInTheDocument();
      await waitFor(() => expect(summaryFetch).toHaveBeenCalled());
      expect(screen.queryByRole("checkbox", { name: /^Mark all/ })).not.toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Mark Todo number 1 as completed" }),
      ).toBeEnabled();
    });

    it("is locked while a row toggle is pending", async () => {
      const server = fakeServer(makeTodos(3, () => false));
      mockFetch().mockImplementation((url: string, init?: RequestInit) =>
        init?.method === "PATCH" && url !== "/todos"
          ? new Promise<Response>(() => {})
          : server.handle(url, init),
      );

      renderPage();
      const toggleAll = await screen.findByRole("checkbox", {
        name: "Mark all 3 todos as completed",
      });
      await userEvent.click(
        screen.getByRole("checkbox", { name: "Mark Todo number 1 as completed" }),
      );

      await waitFor(() => expect(toggleAll).toHaveAttribute("aria-disabled", "true"));
      await userEvent.click(toggleAll);
      expect(server.patchBodies).toHaveLength(0);
    });
  });
  describe("clear completed", () => {
    function clearButton(name: string | RegExp = /^Clear (all|the)/) {
      return screen.findByRole("button", { name });
    }

    it("deletes every completed todo, refreshes, and focuses toggle-all", async () => {
      const server = fakeServer(makeTodos(12, (index) => index >= 8));

      renderPage();

      const button = await clearButton("Clear all 4 completed todos");
      expect(
        screen.queryByText("Applies to all todos, not only this view."),
      ).not.toBeInTheDocument();
      const listGetsBefore = listGetCount();

      await userEvent.click(button);

      expect(await screen.findByText("Cleared 4 completed todos.")).toBeInTheDocument();
      expect(server.deleteUrls).toEqual(["/todos?status=completed"]);
      const deleteCall = mockFetch().mock.calls.find(([, init]) => init?.method === "DELETE");
      expect(deleteCall?.[1]).not.toHaveProperty("body");
      expect(screen.queryByRole("button", { name: /^Clear (all|the)/ })).not.toBeInTheDocument();
      expect(listGetCount()).toBeGreaterThan(listGetsBefore);
      expect(await screen.findByText("8 todos")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Mark all 8 todos as completed" })).toHaveFocus();
    });

    it("focuses the empty heading when no todos remain", async () => {
      fakeServer(makeTodos(2, () => true));

      renderPage();
      await userEvent.click(await clearButton("Clear all 2 completed todos"));

      const heading = await screen.findByRole("heading", { name: "No todos yet." });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByText("Cleared 2 completed todos.")).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: /^Mark all/ })).not.toBeInTheDocument();
    });

    it("counts the whole collection on a filtered view and shows the scope note", async () => {
      fakeServer(makeTodos(12, (index) => index >= 8));

      renderPage("/?status=active");

      const button = await clearButton("Clear all 4 completed todos");
      expect(button).toHaveAccessibleDescription("Applies to all todos, not only this view.");
      expect(await screen.findByText("8 active todos")).toBeInTheDocument();
    });

    it("counts the whole collection across pages", async () => {
      fakeServer(makeTodos(25, (index) => index < 3));

      renderPage("/?page=2");

      expect(await screen.findByText("Todo number 21")).toBeInTheDocument();
      expect(await clearButton("Clear all 3 completed todos")).toBeInTheDocument();
    });

    it("is hidden when no todo is completed", async () => {
      fakeServer(makeTodos(3, () => false));

      renderPage();

      await screen.findByRole("checkbox", { name: "Mark all 3 todos as completed" });
      expect(screen.queryByRole("button", { name: /^Clear (all|the)/ })).not.toBeInTheDocument();
    });

    it("empties the Completed view after clearing", async () => {
      fakeServer(makeTodos(3, (index) => index === 0));

      renderPage("/?status=completed");

      await screen.findByText("Todo number 1");
      await userEvent.click(await clearButton("Clear the 1 completed todo"));

      expect(await screen.findByText("No completed todos.")).toBeInTheDocument();
      expect(await screen.findByText("Cleared 1 completed todo.")).toBeInTheDocument();
    });

    it("locks the button, the rows, and toggle-all while pending", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      let release: () => void = () => {};
      server.failDeleteWith(
        () =>
          new Promise((resolve) => {
            release = () => {
              server.state.items = server.state.items.filter((todo) => !todo.completed);
              resolve(jsonResponse({ deletedCount: 1 }));
            };
          }),
      );

      renderPage();
      const button = await clearButton("Clear the 1 completed todo");
      await userEvent.dblClick(button);

      expect(await screen.findByText("Clearing completed todos")).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveFocus();
      expect(screen.getByText("Todo number 1")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Mark Todo number 2 as completed" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete Todo number 2" })).toBeDisabled();
      const toggleAll = screen.getByRole("checkbox", { name: "Mark all 3 todos as completed" });
      expect(toggleAll).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(toggleAll);
      expect(server.patchBodies).toHaveLength(0);
      expect(server.deleteUrls).toHaveLength(1);

      release();
      expect(await screen.findByText("Cleared 1 completed todo.")).toBeInTheDocument();
      expect(server.deleteUrls).toHaveLength(1);
    });

    it("does not move focus if the user moved it while pending", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      let release: () => void = () => {};
      server.failDeleteWith(
        () =>
          new Promise((resolve) => {
            release = () => {
              server.state.items = server.state.items.filter((todo) => !todo.completed);
              resolve(jsonResponse({ deletedCount: 1 }));
            };
          }),
      );

      renderPage();
      await userEvent.click(await clearButton("Clear the 1 completed todo"));
      await screen.findByText("Clearing completed todos");
      const searchBox = screen.getByRole("searchbox");
      searchBox.focus();

      release();
      expect(await screen.findByText("Cleared 1 completed todo.")).toBeInTheDocument();
      expect(searchBox).toHaveFocus();
    });

    it("keeps focus on the button when completed todos remain after success", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      server.failDeleteWith(async () => {
        server.state.items = server.state.items.filter((todo) => !todo.completed);
        server.state.items.push({ ...makeTodos(4, () => true)[3] });
        return jsonResponse({ deletedCount: 1 });
      });

      renderPage();
      const button = await clearButton("Clear the 1 completed todo");
      await userEvent.click(button);

      expect(await screen.findByText("Cleared 1 completed todo.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Clear the 1 completed todo" })).toHaveFocus();
    });

    it("shows an alert on failure, keeps focus, refreshes, and retries", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      server.failDeleteWith(async () => jsonResponse({ error: { type: "internal" } }, 500));

      renderPage();
      const button = await clearButton("Clear the 1 completed todo");
      const listGetsBefore = listGetCount();
      await userEvent.click(button);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "The server could not clear your completed todos. Try again.",
      );
      expect(alert).not.toHaveTextContent("500");
      expect(button).toHaveFocus();
      await waitFor(() => expect(listGetCount()).toBeGreaterThan(listGetsBefore));
      expect(screen.getByText("Todo number 1")).toBeInTheDocument();

      server.restoreDelete();
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

      expect(await screen.findByText("Cleared 1 completed todo.")).toBeInTheDocument();
      expect(server.deleteUrls).toEqual(["/todos?status=completed", "/todos?status=completed"]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("hides the alert and moves focus when the refetch after a failure shows none left", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      server.failDeleteWith(async () => {
        server.state.items = server.state.items.filter((todo) => !todo.completed);
        throw new TypeError("Failed to fetch");
      });

      renderPage();
      await userEvent.click(await clearButton("Clear the 1 completed todo"));

      const toggleAll = await screen.findByRole("checkbox", {
        name: "Mark all 2 todos as completed",
      });
      await waitFor(() => expect(toggleAll).toHaveFocus());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is hidden when the summary fails and the list still works", async () => {
      fakeServer(makeTodos(3, () => true));
      summaryFetch.mockResolvedValue(jsonResponse({ error: { type: "internal" } }, 500));

      renderPage();

      expect(await screen.findByText("Todo number 1")).toBeInTheDocument();
      await waitFor(() => expect(summaryFetch).toHaveBeenCalled());
      expect(screen.queryByRole("button", { name: /^Clear (all|the)/ })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Mark Todo number 1 as active" })).toBeEnabled();
    });

    it("is locked while a row toggle is pending", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      mockFetch().mockImplementation((url: string, init?: RequestInit) =>
        init?.method === "PATCH" ? new Promise<Response>(() => {}) : server.handle(url, init),
      );

      renderPage();
      const button = await clearButton("Clear the 1 completed todo");
      await userEvent.click(
        screen.getByRole("checkbox", { name: "Mark Todo number 2 as completed" }),
      );

      await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
      await userEvent.click(button);
      expect(server.deleteUrls).toHaveLength(0);
    });

    it("is locked while toggle-all is pending", async () => {
      const server = fakeServer(makeTodos(3, (index) => index === 0));
      server.failPatchWith(() => new Promise<Response>(() => {}));

      renderPage();
      const button = await clearButton("Clear the 1 completed todo");
      await userEvent.click(
        screen.getByRole("checkbox", { name: "Mark all 3 todos as completed" }),
      );

      await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
      await userEvent.click(button);
      expect(server.deleteUrls).toHaveLength(0);
    });
  });
});

describe("HomePage selection mode", () => {
  async function enterSelection() {
    await userEvent.click(await screen.findByRole("button", { name: "Select todos" }));
    return screen.getByRole("group", { name: "Selection" });
  }

  function countText(group: HTMLElement) {
    return within(group).getAllByRole("status")[0];
  }

  function nonGetRequests() {
    return mockFetch().mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
  }

  it("hides Select todos while the list loads and when it is empty", async () => {
    fakeServer([]);

    renderPage();

    expect(screen.queryByRole("button", { name: "Select todos" })).not.toBeInTheDocument();
    expect(await screen.findByText("No todos yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select todos" })).not.toBeInTheDocument();
  });

  it("hides Select todos when the list fails", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    renderPage();

    await screen.findByText(/could not load your todos/i);
    expect(screen.queryByRole("button", { name: "Select todos" })).not.toBeInTheDocument();
  });

  it("locks Select todos while a row toggle is pending", async () => {
    const server = fakeServer(makeTodos(3, () => false));
    mockFetch().mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "PATCH" ? new Promise<Response>(() => {}) : server.handle(url, init),
    );

    renderPage();
    const button = await screen.findByRole("button", { name: "Select todos" });
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Mark Todo number 1 as completed" }),
    );

    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(button);
    expect(screen.queryByRole("group", { name: "Selection" })).not.toBeInTheDocument();
  });

  it("locks Select todos while toggle-all is pending", async () => {
    const server = fakeServer(makeTodos(3, () => false));
    server.failPatchWith(() => new Promise<Response>(() => {}));

    renderPage();
    const button = await screen.findByRole("button", { name: "Select todos" });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Mark all 3 todos as completed" }),
    );

    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(button);
    expect(screen.queryByRole("group", { name: "Selection" })).not.toBeInTheDocument();
  });

  it("enters selection mode, hides the standard batch controls, and focuses Select this page", async () => {
    fakeServer(makeTodos(3, (index) => index === 0));

    renderPage();
    await screen.findByRole("button", { name: "Clear the 1 completed todo" });
    await screen.findByRole("checkbox", { name: /^Mark all/ });

    const group = await enterSelection();

    expect(countText(group)).toHaveTextContent("0 selected");
    expect(within(group).getByRole("button", { name: "Select this page" })).toHaveFocus();
    expect(screen.queryByRole("checkbox", { name: /^Mark all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clear (all|the)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^Mark Todo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Edit|Delete) / })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Todo number 1" })).not.toBeChecked();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Completed");
  });

  it("selects rows without sending a request or changing completion", async () => {
    fakeServer(makeTodos(3, (index) => index === 0));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 2" }));

    expect(countText(group)).toHaveTextContent("2 selected");
    expect(nonGetRequests()).toHaveLength(0);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Completed");
    expect(rows[1]).toHaveTextContent("Active");

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));
    expect(countText(group)).toHaveTextContent("1 selected");
  });

  it("selects and unselects the visible page only", async () => {
    fakeServer(makeTodos(25, () => false));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(within(group).getByRole("button", { name: "Select this page" }));
    expect(countText(group)).toHaveTextContent("20 selected");

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Todo number 21");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 21" }));
    expect(countText(group)).toHaveTextContent("21 selected");

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await screen.findByText("Todo number 1");
    expect(screen.getByRole("checkbox", { name: "Select Todo number 1" })).toBeChecked();
    await userEvent.click(within(group).getByRole("button", { name: "Unselect this page" }));
    expect(countText(group)).toHaveTextContent("1 selected");
    expect(within(group).getByRole("button", { name: "Select this page" })).toBeVisible();
  });

  it("keeps the selection across pages and page sizes", async () => {
    fakeServer(makeTodos(25, () => false));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 2" }));

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Todo number 21");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 22" }));
    expect(countText(group)).toHaveTextContent("2 selected");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Todos per page" }), "50");
    await screen.findByText("Todo number 25");
    expect(screen.getByRole("checkbox", { name: "Select Todo number 2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Todo number 22" })).toBeChecked();
    expect(countText(group)).toHaveTextContent("2 selected");
  });

  it("clears the selection when the status changes and keeps the mode", async () => {
    fakeServer(makeTodos(4, (index) => index < 2));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 3" }));
    expect(countText(group)).toHaveTextContent("1 selected");

    await userEvent.click(await filterLink("Active"));

    await waitFor(() => expect(countText(group)).toHaveTextContent("0 selected"));
    expect(
      within(group).getByText("Selection cleared because the view changed."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: "Select Todo number 3" })).not.toBeChecked();
  });

  it("clears the selection when the search changes", async () => {
    fakeServer(makeTodos(4, () => false));

    const { router } = renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));

    await router.navigate({ to: "/", search: { search: "number" } });

    await waitFor(() => expect(countText(group)).toHaveTextContent("0 selected"));
    expect(
      within(group).getByText("Selection cleared because the view changed."),
    ).toBeInTheDocument();
  });

  it("refuses a row and a page past the 100-item limit", async () => {
    fakeServer(makeTodos(120, () => false));

    renderPage("/?pageSize=100");
    const group = await enterSelection();
    await screen.findByText("Todo number 100");
    await userEvent.click(within(group).getByRole("button", { name: "Select this page" }));
    expect(countText(group)).toHaveTextContent("100 selected");

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Todo number 101");
    const row = screen.getByRole("checkbox", { name: "Select Todo number 101" });
    await userEvent.click(row);

    expect(row).not.toBeChecked();
    expect(countText(group)).toHaveTextContent("100 selected");
    const limit = "You can select up to 100 todos. Unselect some to add more.";
    expect(within(group).getByText(limit)).toBeInTheDocument();

    await userEvent.click(within(group).getByRole("button", { name: "Select this page" }));
    expect(countText(group)).toHaveTextContent("100 selected");
    expect(within(group).getByText(limit)).toBeInTheDocument();
  });

  it("clears the selection, stays on, and focuses Select this page", async () => {
    fakeServer(makeTodos(3, () => false));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));
    const clear = within(group).getByRole("button", { name: "Clear selection" });
    await userEvent.click(clear);

    expect(countText(group)).toHaveTextContent("0 selected");
    expect(clear).toHaveAttribute("aria-disabled", "true");
    expect(within(group).getByRole("button", { name: "Select this page" })).toHaveFocus();
  });

  it("exits with Done, restores the row controls, and focuses Select todos", async () => {
    fakeServer(makeTodos(3, () => false));

    renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));
    await userEvent.click(within(group).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("group", { name: "Selection" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select todos" })).toHaveFocus();
    expect(
      screen.getByRole("checkbox", { name: "Mark Todo number 1 as completed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Todo number 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Mark all/ })).toBeInTheDocument();

    const again = await enterSelection();
    expect(countText(again)).toHaveTextContent("0 selected");
  });

  it("exits with Escape from a row checkbox", async () => {
    fakeServer(makeTodos(3, () => false));

    renderPage();
    await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 2" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "Selection" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select todos" })).toHaveFocus();
  });

  it("exits and focuses the empty heading when the list refetches empty", async () => {
    const server = fakeServer(makeTodos(2, () => false));

    const { queryClient } = renderPage();
    await enterSelection();
    server.state.items = [];
    await queryClient.invalidateQueries();

    const heading = await screen.findByRole("heading", { name: "No todos yet." });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole("group", { name: "Selection" })).not.toBeInTheDocument();
  });

  it("keeps the bar and its Done button when the list fails to refresh", async () => {
    fakeServer(makeTodos(2, () => false));

    const { queryClient } = renderPage();
    const group = await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Todo number 1" }));
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));
    await queryClient.invalidateQueries();

    expect(await screen.findByText(/could not refresh your todos/i)).toBeInTheDocument();
    expect(countText(group)).toHaveTextContent("1 selected");
    expect(within(group).getByRole("button", { name: "Done" })).toBeVisible();
  });
});
