import { expect, test, type Page } from "@playwright/test";

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
  return { items, page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 };
}

async function mockApi(page: Page) {
  const requests: string[] = [];

  // A URL predicate also matches list requests that carry a status query string.
  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const url = new URL(route.request().url());
      requests.push(`${url.pathname}${url.search}`);
      const status = url.searchParams.get("status");
      const items =
        status === "active"
          ? todos.filter((todo) => !todo.completed)
          : status === "completed"
            ? todos.filter((todo) => todo.completed)
            : todos;
      return route.fulfill({ json: listBody(items) });
    },
  );

  return requests;
}

function filterLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Filter todos" }).getByRole("link", { name });
}

test("each filter requests its server filter, updates the URL, and shows only its rows", async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto("/");

  await expect(page.getByText("Buy oat milk")).toBeVisible();
  await expect(page.getByText("Water the plants")).toBeVisible();
  await expect(filterLink(page, "All")).toHaveAttribute("aria-current", "page");

  await filterLink(page, "Active").click();
  await expect(page).toHaveURL(/\/\?status=active$/);
  await expect(page.getByText("Buy oat milk")).toBeVisible();
  await expect(page.getByText("Water the plants")).toHaveCount(0);
  await expect(filterLink(page, "Active")).toHaveAttribute("aria-current", "page");
  await expect(filterLink(page, "All")).not.toHaveAttribute("aria-current", "page");

  await filterLink(page, "Completed").click();
  await expect(page).toHaveURL(/\/\?status=completed$/);
  await expect(page.getByText("Water the plants")).toBeVisible();
  await expect(page.getByText("Buy oat milk")).toHaveCount(0);
  await expect(filterLink(page, "Completed")).toHaveAttribute("aria-current", "page");

  expect(requests).toEqual(["/todos", "/todos?status=active", "/todos?status=completed"]);
});

test("back and forward restore the filter", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Buy oat milk")).toBeVisible();

  await filterLink(page, "Completed").click();
  await expect(page.getByText("Buy oat milk")).toHaveCount(0);
  await expect(page.getByText("Water the plants")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Buy oat milk")).toBeVisible();
  await expect(filterLink(page, "All")).toHaveAttribute("aria-current", "page");

  await page.goForward();
  await expect(page).toHaveURL(/\/\?status=completed$/);
  await expect(filterLink(page, "Completed")).toHaveAttribute("aria-current", "page");
});

test("a bad status in the URL falls back to All", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/?status=done");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Buy oat milk")).toBeVisible();
  await expect(filterLink(page, "All")).toHaveAttribute("aria-current", "page");
  expect(requests).toEqual(["/todos"]);
});
