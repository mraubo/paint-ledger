import { expect, type Page } from "@playwright/test";
import { USER_A } from "../../helpers/seed-fixtures";
import { fillControlledInputs } from "./fill-controlled-input";

export async function signInAsUserA(page: Page): Promise<void> {
  await page.goto("/auth/signin");
  const emailInput = page.getByRole("textbox", { name: "Email" });
  const passwordInput = page.getByRole("textbox", { name: "Password" });
  await expect(emailInput).toBeEditable();

  await fillControlledInputs([
    { input: emailInput, value: USER_A.email },
    { input: passwordInput, value: USER_A.password },
  ]);

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/entries/);
}
