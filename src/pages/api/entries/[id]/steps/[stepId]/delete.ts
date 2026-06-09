import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser } from "@/lib/entries-api";
import { deleteStepAndRenumber } from "@/lib/entry-steps-mutations";
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

  const deleteResult = await deleteStepAndRenumber(supabase, entryId, stepId);
  if (!deleteResult.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(deleteResult.error)}`);
  }

  return context.redirect(`${stepsUrl}?deleted=1`);
};
