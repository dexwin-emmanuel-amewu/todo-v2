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

async function mockApi(page: Page, deleteStatus: number) {
  let remaining = [...todos];
  const deletes: { method: string; url: string; body: string | null }[] = [];

  await page.route("**/todos", (route) => route.fulfill({ json: listBody(remaining) }));
  await page.route("**/todos/*", (route) => {
    const request = route.request();
    deletes.push({ method: request.method(), url: request.url(), body: request.postData() });
    if (deleteStatus === 204 || deleteStatus === 404) {
      remaining = remaining.filter((todo) => !request.url().endsWith(todo.id));
    }
    return route.fulfill({ status: deleteStatus, body: deleteStatus === 204 ? undefined : "{}" });
  });

  return deletes;
}

test("deleting a todo sends DELETE, removes the row, and moves focus to the next Delete", async ({
  page,
}) => {
  const deletes = await mockApi(page, 204);
  await page.goto("/");

  await page.getByRole("button", { name: "Delete Buy oat milk" }).click();

  await expect(page.getByText("Buy oat milk")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Water the plants" })).toBeFocused();
  expect(deletes).toHaveLength(1);
  expect(deletes[0].method).toBe("DELETE");
  expect(deletes[0].url).toContain(`/todos/${todos[0].id}`);
  expect(deletes[0].body).toBeNull();
});

test("a 404 reconciles the stale row", async ({ page }) => {
  await mockApi(page, 404);
  await page.goto("/");

  await page.getByRole("button", { name: "Delete Buy oat milk" }).click();

  await expect(page.getByText("Buy oat milk")).toHaveCount(0);
  await expect(page.getByText("Water the plants")).toBeVisible();
});

test("a server failure keeps the row and shows a retryable message", async ({ page }) => {
  await mockApi(page, 500);
  await page.goto("/");

  await page.getByRole("button", { name: "Delete Buy oat milk" }).click();

  await expect(page.getByRole("alert")).toContainText("could not delete this todo");
  await expect(page.getByText("Buy oat milk")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry delete" })).toBeEnabled();
});
