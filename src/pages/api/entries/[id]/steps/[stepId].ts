import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { syncStepPaintAssignments } from "@/lib/entry-steps-mutations";
import {
  isReturnToEdit,
  isValidStepId,
  parseEntryStepFormData,
  parseStepPaintIds,
  stepEditPath,
  stepsPagePath,
} from "@/lib/entry-steps-api";

export const POST: APIRoute = async (context) => {
  const entryId = context.params.id;
  const stepId = context.params.stepId;

  if (!entryId || !isValidEntryId(entryId)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const stepsUrl = stepsPagePath(entryId);

  if (!stepId || !isValidStepId(stepId)) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Invalid step id")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = parseEntryStepFormData(form);
  if (!parsed.ok) {
    const errorUrl = isReturnToEdit(form) ? `${stepEditPath(entryId, stepId)}&error=` : `${stepsUrl}?error=`;
    return context.redirect(`${errorUrl}${encodeURIComponent(parsed.error)}`);
  }

  const { data: step, error: stepError } = await supabase
    .from("steps")
    .select("id")
    .eq("id", stepId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (stepError) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(stepError))}`);
  }

  if (!step) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Step not found")}`);
  }

  const { error: updateError } = await supabase
    .from("steps")
    .update({ description: parsed.fields.description })
    .eq("id", stepId)
    .eq("entry_id", entryId);

  if (updateError) {
    const errorUrl = isReturnToEdit(form) ? `${stepEditPath(entryId, stepId)}&error=` : `${stepsUrl}?error=`;
    return context.redirect(`${errorUrl}${encodeURIComponent(toUserFacingDbError(updateError))}`);
  }

  const assignmentResult = await syncStepPaintAssignments(supabase, entryId, stepId, parseStepPaintIds(form));
  if (!assignmentResult.ok) {
    const errorUrl = isReturnToEdit(form) ? `${stepEditPath(entryId, stepId)}&error=` : `${stepsUrl}?error=`;
    return context.redirect(`${errorUrl}${encodeURIComponent(assignmentResult.error)}`);
  }

  if (isReturnToEdit(form)) {
    return context.redirect(`${stepEditPath(entryId, stepId)}&updated=1`);
  }

  return context.redirect(`${stepsUrl}?updated=1`);
};
