import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { paintsPagePath, parseEntryPaintFormData } from "@/lib/entry-paints-api";
import { loadEntryExists } from "@/lib/entry-paints-page";

export const POST: APIRoute = async (context) => {
  const entryId = context.params.id;
  if (!entryId || !isValidEntryId(entryId)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const paintsUrl = paintsPagePath(entryId);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
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
  const parsed = parseEntryPaintFormData(form);
  if (!parsed.ok) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent(parsed.error)}`);
  }

  const { fields } = parsed;
  const { error } = await supabase.from("entry_paints").insert({
    entry_id: entryId,
    name: fields.name,
    brand: fields.brand,
    color_description: fields.color_description,
    approximate_color: fields.approximate_color,
  });

  if (error) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent(toUserFacingDbError(error))}`);
  }

  return context.redirect(`${paintsUrl}?added=1`);
};
