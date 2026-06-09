import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser } from "@/lib/entries-api";
import { updateStepWithAssignments } from "@/lib/entry-steps-mutations";
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

  const updateResult = await updateStepWithAssignments(
    supabase,
    entryId,
    stepId,
    parsed.fields.description,
    parseStepPaintIds(form),
  );

  if (!updateResult.ok) {
    const errorUrl = isReturnToEdit(form) ? `${stepEditPath(entryId, stepId)}&error=` : `${stepsUrl}?error=`;
    return context.redirect(`${errorUrl}${encodeURIComponent(updateResult.error)}`);
  }

  if (isReturnToEdit(form)) {
    return context.redirect(`${stepEditPath(entryId, stepId)}&updated=1`);
  }

  return context.redirect(`${stepsUrl}?updated=1`);
};
