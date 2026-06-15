import { expect, type Page } from "@playwright/test";
import { USER_A } from "../../helpers/seed-fixtures";

export async function signInAsUserA(page: Page): Promise<void> {
  await page.goto("/auth/signin");
  const emailInput = page.getByRole("textbox", { name: "Email" });
  await emailInput.click();
  await emailInput.pressSequentially(USER_A.email);
  await page.getByRole("textbox", { name: "Password" }).fill(USER_A.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/entries/);
}
