import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser } from "@/lib/entries-api";
import { loadEntryExists } from "@/lib/entry-paints-page";
import { applyStepPhotoFromForm } from "@/lib/entry-step-photos";
import { createStepAtNextPosition, syncStepPaintAssignments } from "@/lib/entry-steps-mutations";
import { parseEntryStepFormData, parseStepPaintIds, stepsPagePath } from "@/lib/entry-steps-api";

export const POST: APIRoute = async (context) => {
  const entryId = context.params.id;
  if (!entryId || !isValidEntryId(entryId)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const stepsUrl = stepsPagePath(entryId);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const entryExists = await loadEntryExists(supabase, entryId);
  if (!entryExists) {
    return context.redirect(`/entries?error=${encodeURIComponent("Entry not found")}`);
  }

  const form = await context.request.formData();
  const parsed = parseEntryStepFormData(form);
  if (!parsed.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(parsed.error)}`);
  }

  const createResult = await createStepAtNextPosition(supabase, entryId, parsed.fields.description);
  if (!createResult.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(createResult.error)}`);
  }

  const assignResult = await syncStepPaintAssignments(supabase, entryId, createResult.stepId, parseStepPaintIds(form));
  if (!assignResult.ok) {
    return context.redirect(
      `${stepsUrl}?error=${encodeURIComponent(`${assignResult.error} The step was created — edit it to fix paint assignments.`)}`,
    );
  }

  const photoResult = await applyStepPhotoFromForm(supabase, user.id, entryId, createResult.stepId, form);
  if (!photoResult.ok) {
    return context.redirect(
      `${stepsUrl}?error=${encodeURIComponent(`${photoResult.error} The step was created — edit it to fix the photo.`)}`,
    );
  }

  return context.redirect(`${stepsUrl}?added=1`);
};
