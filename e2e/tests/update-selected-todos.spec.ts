import { expect, test, type Page } from "@playwright/test";

type MockTodo = { id: string; title: string; completed: boolean; createdAt: string };

function seedTodos(count: number): MockTodo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Task ${index + 1}`,
    completed: false,
    createdAt: "2026-09-30T10:00:00.000Z",
  }));
}

// An in-memory GET /todos and PATCH /todos/batch that follows the API contract.
async function mockApi(page: Page, count: number) {
  const server = {
    todos: seedTodos(count),
    batchBodies: [] as { ids: string[]; completed: boolean }[],
    failNextBatchWith500: false,
  };

  await page.route(
    (url) => url.pathname === "/todos/batch",
    (route) => {
      const body = route.request().postDataJSON() as { ids: string[]; completed: boolean };
      server.batchBodies.push(body);
      if (server.failNextBatchWith500) {
        server.failNextBatchWith500 = false;
        return route.fulfill({ status: 500, json: { error: { type: "internal" } } });
      }
      const missingIds = body.ids.filter((id) => !server.todos.some((todo) => todo.id === id));
      if (missingIds.length > 0) {
        return route.fulfill({
          status: 409,
          json: { error: { type: "batch_conflict", missingIds } },
        });
      }
      for (const todo of server.todos) {
        if (body.ids.includes(todo.id)) todo.completed = body.completed;
      }
      return route.fulfill({ json: { updatedCount: body.ids.length } });
    },
  );

  await page.route(
    (url) => url.pathname === "/todos",
    (route) => {
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const status = url.searchParams.get("status");
      const matches = server.todos.filter(
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

  return server;
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({
    has: page.getByRole("checkbox", { name: `Select ${title}`, exact: true }),
  });
}

test("marks selected todos, recovers from a conflict, and keeps the selection on failure", async ({
  page,
}) => {
  const server = await mockApi(page, 25);
  await page.goto("/?pageSize=10");

  await page.getByRole("button", { name: "Select todos" }).click();
  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();

  // Success across two pages.
  await page.getByRole("checkbox", { name: "Select Task 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select Task 2", exact: true }).check();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("checkbox", { name: "Select Task 11", exact: true }).check();
  await expect(count).toHaveText("3 selected");

  await bar.getByRole("button", { name: "Mark selected as completed" }).click();

  await expect(bar.getByText("3 todos marked as completed")).toBeVisible();
  await expect(count).toHaveText("0 selected");
  await expect(row(page, "Task 11")).toContainText("Completed");
  await expect(row(page, "Task 12")).toContainText("Active");
  expect(server.batchBodies).toHaveLength(1);
  expect(server.batchBodies[0].completed).toBe(true);
  expect(server.batchBodies[0].ids).toHaveLength(3);

  // Conflict: Task 13 is deleted elsewhere before the request.
  await page.getByRole("checkbox", { name: "Select Task 12", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select Task 13", exact: true }).check();
  server.todos = server.todos.filter((todo) => todo.title !== "Task 13");

  await bar.getByRole("button", { name: "Mark selected as completed" }).click();

  const alert = bar.getByRole("alert");
  await expect(alert).toHaveText(
    /1 selected todo no longer exists\. It was removed from the selection\. Nothing was changed\./,
  );
  await expect(count).toHaveText("1 selected");
  await expect(page.getByText("Task 13", { exact: true })).toHaveCount(0);
  await expect(row(page, "Task 12")).toContainText("Active");

  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(bar.getByText("1 todo marked as completed")).toBeVisible();
  await expect(row(page, "Task 12")).toContainText("Completed");
  await expect(bar.getByRole("alert")).toHaveCount(0);

  // Server error: the selection is kept and Retry sends the same request.
  await page.getByRole("checkbox", { name: "Select Task 11", exact: true }).check();
  server.failNextBatchWith500 = true;
  await bar.getByRole("button", { name: "Mark selected as active" }).click();

  await expect(bar.getByRole("alert")).toContainText(
    "Could not update the selected todos. Nothing was changed.",
  );
  await expect(count).toHaveText("1 selected");
  await expect(row(page, "Task 11")).toContainText("Completed");

  await bar.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(bar.getByText("1 todo marked as active")).toBeVisible();
  await expect(row(page, "Task 11")).toContainText("Active");
  expect(server.batchBodies.at(-1)).toEqual(server.batchBodies.at(-2));
});
