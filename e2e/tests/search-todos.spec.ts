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
  {
    id: "7f3e5d4c-8d3c-4d7c-9d3c-8d3c4d7c9d3c",
    title: "Return milk bottles",
    completed: true,
    createdAt: "2026-09-30T12:00:00.000Z",
  },
];

function listBody(items: typeof todos) {
  return { items, page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 };
}

async function mockApi(page: Page) {
  const requests: string[] = [];

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const url = new URL(route.request().url());
      requests.push(`${url.pathname}${url.search}`);
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search")?.toLowerCase();
      const items = todos.filter(
        (todo) =>
          (status === null || (status === "completed") === todo.completed) &&
          (!search || todo.title.toLowerCase().includes(search)),
      );
      return route.fulfill({ json: listBody(items) });
    },
  );

  return requests;
}

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search todos" });

function filterLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Filter todos" }).getByRole("link", { name });
}

test("typing a search sends one request, updates the URL, and shows only matches", async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("3 todos")).toBeVisible();

  await searchBox(page).pressSequentially("milk");

  await expect(page.getByText('2 todos matching "milk"')).toBeVisible();
  await expect(page).toHaveURL(/\/\?search=milk$/);
  await expect(page.getByText("Water the plants")).toHaveCount(0);
  expect(requests).toEqual(["/todos", "/todos?search=milk"]);
});

test("search combines with the status and clearing it restores the unsearched list", async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto("/?search=milk");
  await expect(page.getByText('2 todos matching "milk"')).toBeVisible();

  await filterLink(page, "Completed").click();
  await expect(page.getByText('1 completed todo matching "milk"')).toBeVisible();
  await expect(page).toHaveURL(/\/\?status=completed&search=milk$/);
  await expect(page.getByText("Return milk bottles")).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();

  await expect(page.getByText("2 completed todos")).toBeVisible();
  await expect(page).toHaveURL(/\/\?status=completed$/);
  await expect(searchBox(page)).toHaveValue("");
  await expect(searchBox(page)).toBeFocused();
  expect(requests).toEqual([
    "/todos?search=milk",
    "/todos?status=completed&search=milk",
    "/todos?status=completed",
  ]);
});

test("a search with no matches shows a message that can clear it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await searchBox(page).fill("zzz");

  await expect(page.getByRole("heading", { name: 'No todos match "zzz".' })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).last().click();
  await expect(page.getByText("3 todos")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("a search over 100 characters shows a message and sends no request", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("3 todos")).toBeVisible();

  await searchBox(page).fill("a".repeat(101));

  await expect(page.getByText("Search must be 100 characters or fewer.")).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toEqual(["/todos"]);
});

test("a failed search shows the retry alert and retry loads the results", async ({ page }) => {
  let fail = true;
  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const search = new URL(route.request().url()).searchParams.get("search");
      if (search && fail)
        return route.fulfill({ status: 500, json: { error: { type: "internal" } } });
      return route.fulfill({ json: listBody(search ? [todos[0]] : todos) });
    },
  );
  await page.goto("/");
  await expect(page.getByText("3 todos")).toBeVisible();

  await searchBox(page).fill("oat");
  await expect(page.getByRole("alert")).toContainText("Could not load your todos.");
  await expect(searchBox(page)).toHaveValue("oat");

  fail = false;
  await page.getByRole("button", { name: /retry/i }).click();
  await expect(page.getByText('1 todo matching "oat"')).toBeVisible();
});

test("back restores the earlier search and the box text", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await searchBox(page).fill("milk");
  await expect(page.getByText('2 todos matching "milk"')).toBeVisible();
  await filterLink(page, "Active").click();
  await expect(page.getByText('1 active todo matching "milk"')).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(/\/\?search=milk$/);
  await expect(searchBox(page)).toHaveValue("milk");
});
