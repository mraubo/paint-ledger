import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser } from "@/lib/entries-api";
import { deleteEntryPhoto } from "@/lib/entry-photos-storage";
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

  const { data: step } = await supabase
    .from("steps")
    .select("storage_path")
    .eq("id", stepId)
    .eq("entry_id", entryId)
    .maybeSingle();

  const deleteResult = await deleteStepAndRenumber(supabase, entryId, stepId);
  if (!deleteResult.ok) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(deleteResult.error)}`);
  }

  if (step?.storage_path) {
    const photoDeleteResult = await deleteEntryPhoto(supabase, step.storage_path);
    if (!photoDeleteResult.ok) {
      // eslint-disable-next-line no-console -- best-effort cleanup after step row removed
      console.warn("Failed to delete step photo from storage:", step.storage_path, photoDeleteResult.error);
    }
  }

  return context.redirect(`${stepsUrl}?deleted=1`);
};
