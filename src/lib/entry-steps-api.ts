import { isValidEntryId } from "@/lib/entries-api";

export interface EntryStepFields {
  description: string;
}

const MAX_TEXT_FIELD_LENGTH = 10_000;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function isValidStepId(id: string): boolean {
  return isValidEntryId(id);
}

export function stepsPagePath(entryId: string): string {
  return `/entries/${entryId}/steps`;
}

export function stepEditPath(entryId: string, stepId: string): string {
  return `/entries/${entryId}/steps?edit=${stepId}`;
}

export function parseEntryStepFormData(
  formData: FormData,
): { ok: true; fields: EntryStepFields } | { ok: false; error: string } {
  const description = readString(formData, "description").trim();

  if (!description) {
    return { ok: false, error: "Step description is required" };
  }

  if (description.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Step description must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  return { ok: true, fields: { description } };
}

export function parseStepPaintIds(formData: FormData): string[] {
  const values = formData.getAll("entry_paint_ids");
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || !isValidEntryId(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    ids.push(value);
  }

  return ids;
}

export function isReturnToEdit(formData: FormData): boolean {
  return readString(formData, "return_to_edit") === "1";
}

export type StepMoveDirection = "up" | "down";

export function parseStepMoveDirection(formData: FormData): StepMoveDirection | null {
  const direction = readString(formData, "direction");
  if (direction === "up" || direction === "down") {
    return direction;
  }

  return null;
}

const STEP_EDIT_REDIRECT_RE =
  /^\/entries\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/steps\?edit=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePaintCreateRedirectTo(formData: FormData, entryId: string): string | null {
  const redirectTo = readString(formData, "redirect_to").trim();
  if (!redirectTo) {
    return null;
  }

  if (!STEP_EDIT_REDIRECT_RE.test(redirectTo)) {
    return null;
  }

  const entryPrefix = `/entries/${entryId}/steps`;
  if (!redirectTo.startsWith(entryPrefix)) {
    return null;
  }

  return redirectTo;
}
