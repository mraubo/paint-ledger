import { test, expect } from "@playwright/test";

test("landing page shows Field Journal marketing copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Master Your Palette/i })).toBeVisible();
  await expect(page.getByText("cosmic developer experience")).not.toBeVisible();
});
