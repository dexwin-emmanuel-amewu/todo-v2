import { createRoute, createRouter, redirect, type RouterHistory } from "@tanstack/react-router";

import { getTodoListSearch } from "./module/todo.filter";
import { getTodoListSearchLink } from "./module/todo.search";
import { HomePage } from "./routes/index";
import { rootRoute } from "./routes/root";

const allowedKeys = ["status", "search", "page", "pageSize"];

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: getTodoListSearch,
  beforeLoad: ({ location, search }) => {
    const raw = location.search as Record<string, unknown>;
    const isCanonical =
      Object.keys(raw).every((key) => allowedKeys.includes(key)) &&
      raw.status === search.status &&
      raw.search === search.search &&
      raw.page === search.page &&
      raw.pageSize === search.pageSize;
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
