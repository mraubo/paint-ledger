import { expect, type Locator } from "@playwright/test";

/** Fill a React controlled input after client:load hydration settles. */
export async function fillControlledInput(input: Locator, value: string): Promise<void> {
  await fillControlledInputs([{ input, value }]);
}

/** Fill multiple React controlled inputs in one retry loop (avoids hydration wiping earlier fields). */
export async function fillControlledInputs(fields: Array<{ input: Locator; value: string }>): Promise<void> {
  await expect(async () => {
    for (const { input, value } of fields) {
      await input.click();
      await input.clear();
      await input.pressSequentially(value);
    }
    for (const { input, value } of fields) {
      await expect(input).toHaveValue(value);
    }
  }).toPass();
}
