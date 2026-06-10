import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { applyFinalPhotoFromForm } from "@/lib/entry-final-photo";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id || !isValidEntryId(id)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const entryUrl = `/entries/${id}/edit`;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${entryUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (entryError) {
    return context.redirect(`${entryUrl}?error=${encodeURIComponent(toUserFacingDbError(entryError))}`);
  }

  if (!entry) {
    return context.redirect(`${entryUrl}?error=${encodeURIComponent("Entry not found")}`);
  }

  const form = await context.request.formData();
  const photoResult = await applyFinalPhotoFromForm(supabase, user.id, id, form);
  if (!photoResult.ok) {
    return context.redirect(`${entryUrl}?error=${encodeURIComponent(photoResult.error)}`);
  }

  return context.redirect(`${entryUrl}?final_photo_saved=1`);
};
