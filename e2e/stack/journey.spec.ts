import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function resetTodos(request: APIRequestContext) {
  expect((await request.patch("/todos", { data: { completed: true } })).ok()).toBe(true);
  expect((await request.delete("/todos?status=completed")).ok()).toBe(true);
}

async function seedTodos(request: APIRequestContext, count: number) {
  const ids: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const response = await request.post("/todos", { data: { title: `Task ${index}` } });
    expect(response.status()).toBe(201);
    ids.push(((await response.json()) as { id: string }).id);
  }
  return ids;
}

async function addTodo(page: Page, title: string) {
  await page.getByLabel("Todo title").fill(title);
  await page.getByRole("button", { name: "Add todo" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

function filterLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Filter todos" }).getByRole("link", { name });
}

function selectBox(page: Page, title: string) {
  return page.getByRole("checkbox", { name: `Select ${title}`, exact: true });
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: selectBox(page, title) });
}

test.beforeEach(async ({ request }) => {
  await resetTodos(request);
});

test("health is served through the web origin", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("starts empty, adds, edits, toggles, and deletes todos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No todos yet." })).toBeVisible();

  await addTodo(page, "Buy oat milk");
  await addTodo(page, "Water the plants");
  await addTodo(page, "Call the plumber");
  await expect(page.getByRole("listitem").nth(0)).toContainText("Buy oat milk");
  await expect(page.getByRole("listitem").nth(2)).toContainText("Call the plumber");
  await expect(page.getByText("3 todos", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Water the plants" }).click();
  await page.getByLabel("Edit title for Water the plants").fill("Water the garden");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Water the garden", { exact: true })).toBeVisible();

  await page.getByText("Buy oat milk", { exact: true }).dblclick();
  await page.getByLabel("Edit title for Buy oat milk").fill("Something else");
  await page.getByLabel("Edit title for Buy oat milk").press("Escape");
  await expect(page.getByText("Buy oat milk", { exact: true })).toBeVisible();
  await expect(page.getByText("Something else")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }).click();
  await expect(page.getByRole("checkbox", { name: "Mark Buy oat milk as active" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Mark Buy oat milk as active" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Mark Buy oat milk as active" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Mark Buy oat milk as completed" }),
  ).not.toBeChecked();

  await page.getByRole("button", { name: "Delete Call the plumber" }).click();
  await expect(page.getByText("Call the plumber")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Call the plumber")).toHaveCount(0);
  await expect(page.getByText("2 todos", { exact: true })).toBeVisible();
});

test("filters and searches against the real server", async ({ page, request }) => {
  const [first] = await seedTodos(request, 3);
  await request.patch(`/todos/${first}`, { data: { completed: true } });
  await page.goto("/");
  await expect(page.getByText("3 todos", { exact: true })).toBeVisible();

  await filterLink(page, "Active").click();
  await expect(page).toHaveURL(/status=active/);
  await expect(page.getByText("Task 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Task 2", { exact: true })).toBeVisible();

  await filterLink(page, "Completed").click();
  await expect(page.getByText("Task 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Task 2", { exact: true })).toHaveCount(0);

  await filterLink(page, "All").click();
  await page.getByRole("searchbox", { name: "Search todos" }).fill("task 3");
  await expect(page.getByText('1 todo matching "task 3"')).toBeVisible();
  await expect(page.getByText("Task 2", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear search" }).first().click();
  await expect(page.getByText("3 todos", { exact: true })).toBeVisible();
});

test("paginates and resets to page 1 on a search", async ({ page, request }) => {
  await seedTodos(request, 25);
  await page.goto("/?pageSize=10");
  await expect(page.getByText("Page 1 of 3. Showing 1 to 10 of 25")).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 3 of 3. Showing 21 to 25 of 25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();

  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByText("Page 2 of 3. Showing 11 to 20 of 25")).toBeVisible();

  await page.getByRole("combobox", { name: "Todos per page" }).selectOption("20");
  await expect(page.getByText("Page 1 of 2. Showing 1 to 20 of 25")).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("searchbox", { name: "Search todos" }).fill("task 2");
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByText('7 todos matching "task 2"')).toBeVisible();
});

test("toggles every todo and clears completed todos", async ({ page, request }) => {
  await seedTodos(request, 25);
  await page.goto("/");

  await page.getByRole("checkbox", { name: "Mark all 25 todos as completed" }).click();
  await expect(page.getByText("Marked 25 todos as completed.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Mark all 25 todos as active" })).toBeChecked();

  await page.getByRole("button", { name: "Clear all 25 completed todos" }).click();
  await expect(page.getByText("Cleared 25 completed todos.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No todos yet." })).toBeFocused();
});

test("marks and deletes selected todos across pages", async ({ page, request }) => {
  await seedTodos(request, 25);
  await page.goto("/?pageSize=10");

  await page.getByRole("button", { name: "Select todos" }).click();
  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();

  await selectBox(page, "Task 1").check();
  await selectBox(page, "Task 2").check();
  await page.getByRole("button", { name: "Next page" }).click();
  await selectBox(page, "Task 11").check();
  await expect(count).toHaveText("3 selected");

  await bar.getByRole("button", { name: "Mark selected as completed" }).click();
  await expect(bar.getByText("3 todos marked as completed")).toBeVisible();
  await expect(count).toHaveText("0 selected");
  await expect(row(page, "Task 11")).toContainText("Completed");

  await selectBox(page, "Task 11").check();
  await bar.getByRole("button", { name: "Mark selected as active" }).click();
  await expect(bar.getByText("1 todo marked as active")).toBeVisible();
  await expect(row(page, "Task 11")).toContainText("Active");

  await selectBox(page, "Task 12").check();
  await selectBox(page, "Task 13").check();
  await bar.getByRole("button", { name: "Delete 2 selected todos" }).click();
  await expect(bar.getByText("Deleted 2 todos.")).toBeVisible();
  await expect(page.getByText("Task 12", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Page 2 of 3. Showing 11 to 20 of 23")).toBeVisible();
});

test("recovers a stale selection after a todo is deleted elsewhere", async ({ page, request }) => {
  const ids = await seedTodos(request, 3);
  await page.goto("/");

  await page.getByRole("button", { name: "Select todos" }).click();
  const bar = page.getByRole("group", { name: "Selection" });
  const count = bar.getByRole("status").first();
  await selectBox(page, "Task 1").check();
  await selectBox(page, "Task 2").check();

  expect((await request.delete(`/todos/${ids[1]}`)).ok()).toBe(true);

  await bar.getByRole("button", { name: "Mark selected as completed" }).click();
  const alert = bar.getByRole("alert");
  await expect(alert).toHaveText(
    /1 selected todo no longer exists\. It was removed from the selection\. Nothing was changed\./,
  );
  await expect(count).toHaveText("1 selected");
  await expect(page.getByText("Task 2", { exact: true })).toHaveCount(0);
  await expect(row(page, "Task 1")).toContainText("Active");

  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(bar.getByText("1 todo marked as completed")).toBeVisible();
  await expect(row(page, "Task 1")).toContainText("Completed");

  await selectBox(page, "Task 1").check();
  await selectBox(page, "Task 3").check();
  expect((await request.delete(`/todos/${ids[2]}`)).ok()).toBe(true);

  await bar.getByRole("button", { name: "Delete 2 selected todos" }).click();
  await expect(bar.getByRole("alert")).toContainText("Nothing was deleted.");
  await expect(count).toHaveText("1 selected");

  await bar.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "No todos yet." })).toBeFocused();
  await expect(bar).toHaveCount(0);
  expect(((await (await request.get("/todos")).json()) as { totalItems: number }).totalItems).toBe(
    0,
  );
});
