/**
 * Risk: entry workflow browser green path (forms, redirects, flash banners, step delete dialog).
 * Seed: tests/e2e/seed.spec.ts
 * Plan: context/changes/e2e-green-path/plan.md — Phase 2
 */
import { test, expect } from "@playwright/test";
import { signInAsUserA } from "./helpers/sign-in";

test("entry workflow green path: create entry, add paint, add step, remove step, delete entry", async ({ page }) => {
  const entryTitle = `E2E Workflow ${Date.now()}`;
  const paintName = `E2E Paint ${Date.now()}`;
  const stepDescription = `E2E Step ${Date.now()}`;

  // Sign in as seed user A
  await signInAsUserA(page);

  // Create entry with unique title
  await page.getByRole("link", { name: "Create entry" }).click();
  const titleInput = page.getByRole("textbox", { name: "Title" });
  await titleInput.click();
  await titleInput.pressSequentially(entryTitle);
  await page.getByRole("button", { name: "Create entry" }).click();
  await expect(page).toHaveURL(/created=/);
  await expect(page.getByText("Entry created")).toBeVisible();

  const createdUrl = new URL(page.url());
  const entryId = createdUrl.searchParams.get("created");
  expect(entryId).toBeTruthy();

  // Navigate to paints page and add paint (wait for React island hydration)
  await page.goto(`/entries/${entryId}/paints`);
  const paintNameInput = page.getByRole("textbox", { name: "Paint name" });
  await expect(paintNameInput).toBeEditable();
  await paintNameInput.click();
  await paintNameInput.pressSequentially(paintName);
  await page.getByRole("button", { name: "Add paint" }).click();
  await expect(page).toHaveURL(/added=1/);
  await expect(page.getByText("Paint added")).toBeVisible();

  // Open steps page (direct navigation — paints already added on paints page)
  await page.goto(`/entries/${entryId}/steps`);
  await expect(page).toHaveURL(new RegExp(`/entries/${entryId}/steps`));

  const stepDescriptionInput = page.getByRole("textbox", { name: "Step description" });
  await expect(stepDescriptionInput).toBeEditable();
  await stepDescriptionInput.click();
  await stepDescriptionInput.pressSequentially(stepDescription);
  await expect(stepDescriptionInput).toHaveValue(stepDescription);
  await expect(page.getByRole("checkbox", { name: paintName })).toBeVisible();
  await page.getByRole("checkbox", { name: paintName }).check();
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page).toHaveURL(/added=1/);
  await expect(page.getByText("Step added")).toBeVisible();

  // Remove step — native confirm dialog; scope Delete to the step row
  const stepRow = page.getByRole("listitem").filter({ hasText: stepDescription });
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await stepRow.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(page.getByText("Step deleted")).toBeVisible();

  // Delete entire entry from list — native confirm dialog; reuse entry title from create
  await page.goto("/entries");
  const entryRow = page.getByRole("listitem").filter({ hasText: entryTitle });
  await expect(entryRow.getByRole("link", { name: entryTitle })).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await entryRow.getByRole("button", { name: "Entry actions" }).click();
  await expect(entryRow.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await entryRow.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page).toHaveURL(/deleted=/);
  await expect(page.getByText(`"${entryTitle}" deleted`)).toBeVisible();
  await expect(page.getByRole("link", { name: entryTitle })).not.toBeVisible();
});
