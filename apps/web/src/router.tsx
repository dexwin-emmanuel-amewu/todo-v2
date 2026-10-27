import { createRoute, createRouter, redirect, type RouterHistory } from "@tanstack/react-router";

import { getTodoListSearch } from "./module/todo.filter";
import { getTodoListSearchLink } from "./module/todo.search";
import { HomePage } from "./routes/index";
import { rootRoute } from "./routes/root";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: getTodoListSearch,
  beforeLoad: ({ location, search }) => {
    const raw = location.search as Record<string, unknown>;
    const isCanonical =
      Object.keys(raw).every((key) => key === "status" || key === "search") &&
      raw.status === search.status &&
      raw.search === search.search;
    if (!isCanonical) {
      throw redirect({ to: "/", search: getTodoListSearchLink(search), replace: true });
    }
  },
  component: HomePage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
