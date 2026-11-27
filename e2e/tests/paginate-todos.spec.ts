import { expect, test, type Page } from "@playwright/test";

// Task 1..45 in order. Even numbers are completed.
const allTodos = Array.from({ length: 45 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title: `Task ${index + 1}`,
  completed: (index + 1) % 2 === 0,
  createdAt: "2026-09-30T10:00:00.000Z",
}));

async function mockApi(page: Page) {
  const requests: string[] = [];

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const url = new URL(route.request().url());

      if (url.searchParams.get("pageSize") !== "1") requests.push(`${url.pathname}${url.search}`);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search")?.toLowerCase();
      const matches = allTodos.filter(
        (todo) =>
          (status === null || (status === "completed") === todo.completed) &&
          (!search || todo.title.toLowerCase().includes(search)),
      );
      return route.fulfill({
        json: {
          items: matches.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
          page: pageNumber,
          pageSize,
          totalItems: matches.length,
          totalPages: matches.length === 0 ? 0 : Math.ceil(matches.length / pageSize),
        },
      });
    },
  );

  return requests;
}

const nextButton = (page: Page) => page.getByRole("button", { name: "Next page" });
const previousButton = (page: Page) => page.getByRole("button", { name: "Previous page" });
const pageSizeSelect = (page: Page) => page.getByRole("combobox", { name: "Todos per page" });

function filterLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Filter todos" }).getByRole("link", { name });
}

test("moves between pages with the buttons and the keyboard", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeVisible();
  await expect(previousButton(page)).toHaveAttribute("aria-disabled", "true");

  await nextButton(page).click();

  await expect(page.getByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeVisible();
  await expect(page).toHaveURL(/\/\?page=2$/);
  await expect(page.getByText("Task 21", { exact: true })).toBeVisible();
  await expect(nextButton(page)).toBeFocused();

  await page.keyboard.press("Enter");

  await expect(page.getByText("Page 3 of 3. Showing 41 to 45 of 45")).toBeVisible();
  await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(nextButton(page)).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(previousButton(page)).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeVisible();
  // Going back to page 2 comes from the cache, so it sends no fourth request.
  expect(requests).toEqual(["/todos", "/todos?page=2", "/todos?page=3"]);
});

test("back and forward restore the earlier page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await nextButton(page).click();
  await expect(page.getByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeVisible();

  await page.goBack();

  await expect(page.getByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("changing the page size resets to page 1 and the size survives a filter change", async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto("/?page=2");
  await expect(page.getByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeVisible();

  await pageSizeSelect(page).focus();
  await pageSizeSelect(page).selectOption("10");

  await expect(page.getByText("Page 1 of 5. Showing 1 to 10 of 45")).toBeVisible();
  await expect(page).toHaveURL(/\/\?pageSize=10$/);
  await expect(pageSizeSelect(page)).toBeFocused();

  await nextButton(page).click();
  await expect(page.getByText("Page 2 of 5. Showing 11 to 20 of 45")).toBeVisible();

  await filterLink(page, "Active").click();

  await expect(page.getByText("Page 1 of 3. Showing 1 to 10 of 23")).toBeVisible();
  await expect(page).toHaveURL(/\/\?status=active&pageSize=10$/);
  expect(requests.at(-1)).toBe("/todos?status=active&pageSize=10");
});

test("a search change resets to page 1", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/?page=2");
  await expect(page.getByText("Page 2 of 3. Showing 21 to 40 of 45")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search todos" }).fill("task 4");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/\?search=task\+4$/);
  await expect(page.getByText('7 todos matching "task 4"')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
  expect(requests.at(-1)).toBe("/todos?search=task+4");
});

test("a page past the end moves to the last page", async ({ page }) => {
  const requests = await mockApi(page);

  await page.goto("/?page=9");

  await expect(page.getByText("Page 3 of 3. Showing 41 to 45 of 45")).toBeVisible();
  await expect(page).toHaveURL(/\/\?page=3$/);
  expect(requests).toEqual(["/todos?page=9", "/todos?page=3"]);
});

test("bad page values are dropped from the URL", async ({ page }) => {
  const requests = await mockApi(page);

  await page.goto("/?page=abc&pageSize=7");

  await expect(page.getByText("Page 1 of 3. Showing 1 to 20 of 45")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(requests).toEqual(["/todos"]);
});
