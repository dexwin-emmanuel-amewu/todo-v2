import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getTodoListSearch } from "../module/todo.filter";
import { TodoFilters } from "./TodoFilters";

function renderFilters(url: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <TodoFilters />
        <Outlet />
      </>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    validateSearch: getTodoListSearch,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });

  render(<RouterProvider router={router} />);
  return router;
}

async function filterLinks() {
  const nav = await screen.findByRole("navigation", { name: "Filter todos" });
  return {
    all: within(nav).getByRole("link", { name: "All" }),
    active: within(nav).getByRole("link", { name: "Active" }),
    completed: within(nav).getByRole("link", { name: "Completed" }),
  };
}

describe("TodoFilters", () => {
  it("shows All, Active, and Completed links in a labelled navigation group", async () => {
    renderFilters("/");

    const links = await filterLinks();

    expect(links.all).toHaveAttribute("href", "/");
    expect(links.active).toHaveAttribute("href", "/?status=active");
    expect(links.completed).toHaveAttribute("href", "/?status=completed");
  });

  it("marks only All as the current page on the default URL", async () => {
    renderFilters("/");

    const links = await filterLinks();

    expect(links.all).toHaveAttribute("aria-current", "page");
    expect(links.active).not.toHaveAttribute("aria-current");
    expect(links.completed).not.toHaveAttribute("aria-current");
  });

  it("marks only the filter from the URL as the current page and styles it as selected", async () => {
    renderFilters("/?status=completed");

    const links = await filterLinks();

    expect(links.completed).toHaveAttribute("aria-current", "page");
    expect(links.completed).toHaveClass("bg-slate-900", "text-white");
    expect(links.all).not.toHaveAttribute("aria-current");
    expect(links.all).not.toHaveClass("bg-slate-900");
    expect(links.active).not.toHaveAttribute("aria-current");
    expect(links.active).not.toHaveClass("bg-slate-900");
  });

  it("moves the selection and updates the URL when another filter is chosen", async () => {
    const router = renderFilters("/");
    const user = userEvent.setup();

    await user.click((await filterLinks()).active);

    expect(router.state.location.href).toBe("/?status=active");
    const links = await filterLinks();
    expect(links.active).toHaveAttribute("aria-current", "page");
    expect(links.all).not.toHaveAttribute("aria-current");
  });
});
