import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { renumberStepsAfterDelete } from "@/lib/entry-steps-mutations";
import { isValidStepId, stepsPagePath } from "@/lib/entry-steps-api";

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

  const { data: step, error: stepError } = await supabase
    .from("steps")
    .select("id, position")
    .eq("id", stepId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (stepError) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(stepError))}`);
  }

  if (!step) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Step not found")}`);
  }

  const { error: deleteError } = await supabase.from("steps").delete().eq("id", stepId).eq("entry_id", entryId);

  if (deleteError) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(deleteError))}`);
  }

  const renumberResult = await renumberStepsAfterDelete(supabase, entryId, step.position);
  if (!renumberResult.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(renumberResult.error)}`);
  }

  return context.redirect(`${stepsUrl}?deleted=1`);
};
