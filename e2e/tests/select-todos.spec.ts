import { expect, test, type Page } from "@playwright/test";

type MockTodo = { id: string; title: string; completed: boolean; createdAt: string };

// Task 1..count in order. Every third task is completed.
function seedTodos(count: number): MockTodo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Task ${index + 1}`,
    completed: index % 3 === 0,
    createdAt: "2026-09-30T10:00:00.000Z",
  }));
}

async function mockApi(page: Page, count: number) {
  const todos = seedTodos(count);
  const methods: string[] = [];

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const request = route.request();
      methods.push(request.method());

      const url = new URL(request.url());
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const status = url.searchParams.get("status");
      const matches = todos.filter(
        (todo) => status === null || (status === "completed") === todo.completed,
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

  return { methods };
}

test("selects across pages, keeps completion apart, and clears on a filter change", async ({
  page,
}) => {
  const { methods } = await mockApi(page, 25);
  await page.goto("/?pageSize=10");

  await expect(page.getByRole("checkbox", { name: /^Mark all/ })).toBeVisible();
  await page.getByRole("button", { name: "Select todos" }).click();

  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();
  await expect(count).toHaveText("0 selected");
  await expect(bar.getByRole("button", { name: "Select this page" })).toBeFocused();
  await expect(page.getByRole("checkbox", { name: /^Mark all/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Clear (all|the)/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^Mark Task/ })).toHaveCount(0);

  // Task 1 is completed. Selecting it keeps its badge.
  await page.getByRole("checkbox", { name: "Select Task 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select Task 2", exact: true }).check();
  await expect(count).toHaveText("2 selected");
  await expect(page.getByRole("listitem").first()).toContainText("Completed");
  await expect(page.getByRole("listitem").nth(1)).toContainText("Active");

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Task 11", { exact: true })).toBeVisible();
  await bar.getByRole("button", { name: "Select this page" }).click();
  await expect(count).toHaveText("12 selected");
  await expect(bar.getByRole("button", { name: "Unselect this page" })).toBeVisible();

  await page.getByRole("combobox", { name: "Todos per page" }).selectOption("50");
  await expect(page.getByText("Task 25", { exact: true })).toBeVisible();
  await expect(count).toHaveText("12 selected");
  await expect(page.getByRole("checkbox", { name: "Select Task 1", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Select Task 20", exact: true })).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select Task 21", exact: true }),
  ).not.toBeChecked();

  await page
    .getByRole("navigation", { name: "Filter todos" })
    .getByRole("link", { name: "Active" })
    .click();
  await expect(count).toHaveText("0 selected");
  await expect(bar.getByText("Selection cleared because the view changed.")).toBeVisible();

  await page.getByRole("checkbox", { name: "Select Task 2", exact: true }).check();
  await expect(count).toHaveText("1 selected");
  await bar.getByRole("button", { name: "Clear selection" }).click();
  await expect(count).toHaveText("0 selected");
  await expect(bar.getByRole("button", { name: "Select this page" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select todos" })).toBeFocused();
  await expect(page.getByRole("checkbox", { name: "Mark Task 2 as completed" })).toBeVisible();

  expect(methods.every((method) => method === "GET")).toBe(true);
});

test("refuses a selection past 100 todos", async ({ page }) => {
  const { methods } = await mockApi(page, 105);
  await page.goto("/?pageSize=100");

  await page.getByRole("button", { name: "Select todos" }).click();
  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();
  await expect(page.getByText("Task 100", { exact: true })).toBeVisible();

  await bar.getByRole("button", { name: "Select this page" }).click();
  await expect(count).toHaveText("100 selected");

  await page.getByRole("button", { name: "Next page" }).click();
  const extra = page.getByRole("checkbox", { name: "Select Task 101", exact: true });
  await expect(extra).toBeVisible();
  await extra.click();

  await expect(extra).not.toBeChecked();
  await expect(count).toHaveText("100 selected");
  await expect(
    bar.getByText("You can select up to 100 todos. Unselect some to add more."),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Select todos" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Selection" })).toHaveCount(0);

  expect(methods.every((method) => method === "GET")).toBe(true);
});
