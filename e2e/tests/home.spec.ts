import { expect, test } from "@playwright/test";

test("home page renders the shell and settles into a server state", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Todo" })).toBeVisible();

  const settled = page
    .getByRole("list")
    .or(page.getByRole("alert"))
    .or(page.getByText(/no todos yet/i));

  await expect(settled.first()).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});
