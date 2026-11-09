import { expect, test, type Page } from "@playwright/test";

type MockTodo = { id: string; title: string; completed: boolean; createdAt: string };

// Task 1..25 in order. Task 1 to 20 are active, Task 21 to 25 are completed.
function seedTodos(): MockTodo[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Task ${index + 1}`,
    completed: index >= 20,
    createdAt: "2026-09-30T10:00:00.000Z",
  }));
}

async function mockApi(page: Page) {
  const todos = seedTodos();
  const patchBodies: unknown[] = [];
  const control = { failNextPatch: false };

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const request = route.request();

      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as { completed: boolean };
        patchBodies.push(body);
        if (control.failNextPatch) {
          control.failNextPatch = false;
          return route.fulfill({ status: 500, json: { error: { type: "internal" } } });
        }
        const changed = todos.filter((todo) => todo.completed !== body.completed);
        for (const todo of changed) todo.completed = body.completed;
        return route.fulfill({ json: { updatedCount: changed.length } });
      }

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

  return { patchBodies, control };
}

test("marks the whole collection from a filtered view, then marks it active again", async ({
  page,
}) => {
  const { patchBodies } = await mockApi(page);
  await page.goto("/?status=completed");

  const markCompleted = page.getByRole("checkbox", { name: "Mark all 25 todos as completed" });
  await expect(markCompleted).not.toBeChecked();
  await expect(markCompleted).toHaveAccessibleDescription(
    "Applies to all todos, not only this view.",
  );
  await expect(page.getByText("5 completed todos", { exact: true })).toBeVisible();

  await markCompleted.click();

  const markActive = page.getByRole("checkbox", { name: "Mark all 25 todos as active" });
  await expect(markActive).toBeChecked();
  await expect(page.getByText("Marked 20 todos as completed.")).toBeVisible();
  await expect(page.getByText("25 completed todos", { exact: true })).toBeVisible();
  await expect(markActive).toBeFocused();
  expect(patchBodies).toEqual([{ completed: true }]);

  await page.keyboard.press("Space");

  await expect(
    page.getByRole("checkbox", { name: "Mark all 25 todos as completed" }),
  ).not.toBeChecked();
  await expect(page.getByText("No completed todos.")).toBeVisible();
  expect(patchBodies).toEqual([{ completed: true }, { completed: false }]);
});

test("empties the Active view across pages after marking all completed", async ({ page }) => {
  await mockApi(page);
  await page.goto("/?status=active&page=1");
  await expect(page.getByText("Task 1", { exact: true })).toBeVisible();

  await page.getByRole("checkbox", { name: "Mark all 25 todos as completed" }).click();

  await expect(page.getByText("No active todos.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
});

test("shows a failure with retry and keeps the list usable", async ({ page }) => {
  const { patchBodies, control } = await mockApi(page);
  control.failNextPatch = true;
  await page.goto("/");

  const markCompleted = page.getByRole("checkbox", { name: "Mark all 25 todos as completed" });
  await markCompleted.click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("The server could not update your todos. Try again.");
  await expect(markCompleted).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Mark Task 1 as completed" })).toBeEnabled();

  await alert.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByRole("checkbox", { name: "Mark all 25 todos as active" })).toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(patchBodies).toEqual([{ completed: true }, { completed: true }]);
});
