import { createRoute, createRouter, redirect, type RouterHistory } from "@tanstack/react-router";

import { getTodoListSearch } from "./module/todo.filter";
import { HomePage } from "./routes/index";
import { rootRoute } from "./routes/root";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: getTodoListSearch,
  beforeLoad: ({ location, search }) => {
    const expectedSearchStr = search.status ? `?status=${search.status}` : "";
    if (location.searchStr !== expectedSearchStr) {
      throw redirect({ to: "/", search: { status: search.status }, replace: true });
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
