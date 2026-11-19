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

async function mockApi(page: Page, count: number) {
  const server = {
    todos: seedTodos(count),
    deleteBodies: [] as { ids: string[] }[],
    failNextDeleteWith500: false,
  };

  await page.route(
    (url) => url.pathname === "/todos/batch-delete",
    (route) => {
      const body = route.request().postDataJSON() as { ids: string[] };
      server.deleteBodies.push(body);
      if (server.failNextDeleteWith500) {
        server.failNextDeleteWith500 = false;
        return route.fulfill({ status: 500, json: { error: { type: "internal" } } });
      }
      const missingIds = body.ids.filter((id) => !server.todos.some((todo) => todo.id === id));
      if (missingIds.length > 0) {
        return route.fulfill({
          status: 409,
          json: { error: { type: "batch_conflict", missingIds } },
        });
      }
      server.todos = server.todos.filter((todo) => !body.ids.includes(todo.id));
      return route.fulfill({ json: { deletedCount: body.ids.length } });
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

function selectBox(page: Page, title: string) {
  return page.getByRole("checkbox", { name: `Select ${title}`, exact: true });
}

test("deletes selected todos, recovers from a conflict, and keeps the selection on failure", async ({
  page,
}) => {
  const server = await mockApi(page, 25);
  await page.goto("/?pageSize=10");

  await page.getByRole("button", { name: "Select todos" }).click();
  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();
  await expect(bar.getByText("Deleted todos cannot be restored.")).toBeVisible();

  await selectBox(page, "Task 1").check();
  await selectBox(page, "Task 2").check();
  await page.getByRole("button", { name: "Next page" }).click();
  await selectBox(page, "Task 11").check();
  await expect(count).toHaveText("3 selected");

  await bar.getByRole("button", { name: "Delete 3 selected todos" }).click();

  await expect(bar.getByText("Deleted 3 todos.")).toBeVisible();
  await expect(count).toHaveText("0 selected");
  await expect(selectBox(page, "Task 11")).toHaveCount(0);
  expect(server.deleteBodies).toHaveLength(1);
  expect(server.deleteBodies[0].ids).toHaveLength(3);
  expect(server.todos).toHaveLength(22);

  await selectBox(page, "Task 14").check();
  await selectBox(page, "Task 15").check();
  server.todos = server.todos.filter((todo) => todo.title !== "Task 15");

  await bar.getByRole("button", { name: "Delete 2 selected todos" }).click();

  const alert = bar.getByRole("alert");
  await expect(alert).toHaveText(
    /1 selected todo no longer exists\. It was removed from the selection\. Nothing was deleted\./,
  );
  await expect(count).toHaveText("1 selected");
  await expect(page.getByText("Task 15", { exact: true })).toHaveCount(0);
  await expect(selectBox(page, "Task 14")).toBeChecked();

  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(bar.getByText("Deleted 1 todo.")).toBeVisible();
  await expect(selectBox(page, "Task 14")).toHaveCount(0);
  await expect(bar.getByRole("alert")).toHaveCount(0);

  await selectBox(page, "Task 16").check();
  server.failNextDeleteWith500 = true;
  await bar.getByRole("button", { name: "Delete 1 selected todo" }).click();

  await expect(bar.getByRole("alert")).toContainText(
    "Could not delete the selected todos. Nothing was deleted.",
  );
  await expect(count).toHaveText("1 selected");
  await expect(selectBox(page, "Task 16")).toBeChecked();

  await bar.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(bar.getByText("Deleted 1 todo.")).toBeVisible();
  await expect(selectBox(page, "Task 16")).toHaveCount(0);
  expect(server.deleteBodies.at(-1)).toEqual(server.deleteBodies.at(-2));
});
