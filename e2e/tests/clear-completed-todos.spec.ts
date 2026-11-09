import { expect, test, type Page } from "@playwright/test";

type MockTodo = { id: string; title: string; completed: boolean; createdAt: string };

// Task 1..25 in order. Task 1 to 3 are completed, Task 4 to 25 are active.
function seedTodos(isCompleted: (index: number) => boolean): MockTodo[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Task ${index + 1}`,
    completed: isCompleted(index),
    createdAt: "2026-09-30T10:00:00.000Z",
  }));
}

async function mockApi(page: Page, isCompleted: (index: number) => boolean = (index) => index < 3) {
  const state = { todos: seedTodos(isCompleted) };
  const deleteUrls: string[] = [];
  const control = { failNextDelete: false };

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "DELETE") {
        deleteUrls.push(`${url.pathname}${url.search}`);
        if (control.failNextDelete) {
          control.failNextDelete = false;
          return route.fulfill({ status: 500, json: { error: { type: "internal" } } });
        }
        const before = state.todos.length;
        state.todos = state.todos.filter((todo) => !todo.completed);
        return route.fulfill({ json: { deletedCount: before - state.todos.length } });
      }

      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const status = url.searchParams.get("status");
      const matches = state.todos.filter(
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

  return { deleteUrls, control };
}

test("clears every completed todo from a filtered later page", async ({ page }) => {
  const { deleteUrls } = await mockApi(page);
  await page.goto("/?status=active&page=2");
  await expect(page.getByText("Task 24", { exact: true })).toBeVisible();

  const clear = page.getByRole("button", { name: "Clear all 3 completed todos" });
  await expect(clear).toHaveAccessibleDescription("Applies to all todos, not only this view.");
  await expect(page.getByText("22 active todos", { exact: true })).toBeVisible();

  await clear.click();

  await expect(page.getByText("Cleared 3 completed todos.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Clear (all|the)/ })).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Mark all 22 todos as completed" }),
  ).toBeFocused();
  await expect(page.getByText("22 active todos", { exact: true })).toBeVisible();
  expect(deleteUrls).toEqual(["/todos?status=completed"]);
});

test("is not shown when no todo is completed", async ({ page }) => {
  await mockApi(page, () => false);
  await page.goto("/");

  await expect(
    page.getByRole("checkbox", { name: "Mark all 25 todos as completed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Clear (all|the)/ })).toHaveCount(0);
});

test("focuses the empty heading when the last todos are cleared", async ({ page }) => {
  const { deleteUrls } = await mockApi(page, () => true);
  await page.goto("/");

  const clear = page.getByRole("button", { name: "Clear all 25 completed todos" });
  await clear.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "No todos yet." })).toBeFocused();
  await expect(page.getByText("Cleared 25 completed todos.")).toBeVisible();
  expect(deleteUrls).toEqual(["/todos?status=completed"]);
});

test("shows a failure with retry and keeps the list usable", async ({ page }) => {
  const { deleteUrls, control } = await mockApi(page);
  control.failNextDelete = true;
  await page.goto("/");

  const clear = page.getByRole("button", { name: "Clear all 3 completed todos" });
  await clear.click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("The server could not clear your completed todos. Try again.");
  await expect(clear).toBeFocused();
  await expect(page.getByText("Task 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Mark Task 4 as completed" })).toBeEnabled();

  await alert.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByText("Cleared 3 completed todos.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Task 1", { exact: true })).toHaveCount(0);
  expect(deleteUrls).toEqual(["/todos?status=completed", "/todos?status=completed"]);
});
