import { test, expect } from "@playwright/test";
import { signInAsUserA } from "./helpers/sign-in";
import { parseEntryIdFromEditUrl } from "./helpers/entry-url";
import { fillControlledInput } from "./helpers/fill-controlled-input";

test("created entry persists after reload and can be deleted", async ({ page }) => {
  const entryTitle = `Test Entry ${Date.now()}`;

  await signInAsUserA(page);

  await page.getByRole("link", { name: "Create entry" }).click();
  const titleInput = page.getByRole("textbox", { name: "Title" });
  await fillControlledInput(titleInput, entryTitle);
  await page.getByRole("button", { name: "Create entry" }).click();

  await expect(page).toHaveURL(/\/entries\/[^/]+\/edit\?created=1/);
  await expect(page.getByText("Entry created")).toBeVisible();
  await expect(titleInput).toHaveValue(entryTitle);

  const entryId = parseEntryIdFromEditUrl(page.url());

  await page.reload();
  await expect(titleInput).toHaveValue(entryTitle);

  await page.goto("/entries");
  await expect(page.getByRole("link", { name: entryTitle })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: entryTitle })).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: entryTitle });

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await row.getByRole("button", { name: "Entry actions" }).click();
  await expect(row.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await row.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page).toHaveURL(/deleted=/);
  await expect(page.getByText(`"${entryTitle}" deleted`)).toBeVisible();
  await expect(page.getByRole("link", { name: entryTitle })).not.toBeVisible();

  // Sanity: entry id was valid UUID-shaped path segment
  expect(entryId).toMatch(/^[0-9a-f-]{36}$/i);
});
