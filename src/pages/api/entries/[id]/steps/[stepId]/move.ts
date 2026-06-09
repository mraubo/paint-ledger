import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { swapStepPositions } from "@/lib/entry-steps-mutations";
import { isValidStepId, parseStepMoveDirection, stepsPagePath } from "@/lib/entry-steps-api";

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
  const direction = parseStepMoveDirection(form);
  if (!direction) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Invalid move direction")}`);
  }

  const { data: currentStep, error: currentError } = await supabase
    .from("steps")
    .select("id, position")
    .eq("id", stepId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (currentError) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(currentError))}`);
  }

  if (!currentStep) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent("Step not found")}`);
  }

  const neighborPosition = direction === "up" ? currentStep.position - 1 : currentStep.position + 1;

  const { data: neighborStep, error: neighborError } = await supabase
    .from("steps")
    .select("id, position")
    .eq("entry_id", entryId)
    .eq("position", neighborPosition)
    .maybeSingle();

  if (neighborError) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(neighborError))}`);
  }

  if (!neighborStep) {
    const message = direction === "up" ? "Step is already at the top" : "Step is already at the bottom";
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(message)}`);
  }

  const swapResult = await swapStepPositions(
    supabase,
    entryId,
    currentStep.id,
    neighborStep.id,
    currentStep.position,
    neighborStep.position,
  );

  if (!swapResult.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(swapResult.error)}`);
  }

  return context.redirect(`${stepsUrl}?moved=1`);
};
