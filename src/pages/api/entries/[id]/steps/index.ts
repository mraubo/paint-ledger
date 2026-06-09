import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { loadEntryExists } from "@/lib/entry-paints-page";
import { parseEntryStepFormData, stepsPagePath } from "@/lib/entry-steps-api";

async function nextStepPosition(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  entryId: string,
): Promise<number> {
  const { data } = await supabase
    .from("steps")
    .select("position")
    .eq("entry_id", entryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? data.position + 1 : 1;
}

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

  const position = await nextStepPosition(supabase, entryId);
  const { error } = await supabase.from("steps").insert({
    entry_id: entryId,
    position,
    description: parsed.fields.description,
  });

  if (error) {
    return context.redirect(`${stepsUrl}?error=${encodeURIComponent(toUserFacingDbError(error))}`);
  }

  return context.redirect(`${stepsUrl}?added=1`);
};
