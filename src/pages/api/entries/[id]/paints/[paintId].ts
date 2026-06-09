import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { isValidPaintId, paintsPagePath, parseEntryPaintFormData } from "@/lib/entry-paints-api";

export const POST: APIRoute = async (context) => {
  const entryId = context.params.id;
  const paintId = context.params.paintId;

  if (!entryId || !isValidEntryId(entryId)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const paintsUrl = paintsPagePath(entryId);

  if (!paintId || !isValidPaintId(paintId)) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent("Invalid paint id")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = parseEntryPaintFormData(form);
  if (!parsed.ok) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent(parsed.error)}`);
  }

  const { fields } = parsed;
  const { data, error } = await supabase
    .from("entry_paints")
    .update({
      name: fields.name,
      brand: fields.brand,
      color_description: fields.color_description,
      approximate_color: fields.approximate_color,
    })
    .eq("id", paintId)
    .eq("entry_id", entryId)
    .select("id")
    .maybeSingle();

  if (error) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent(toUserFacingDbError(error))}`);
  }

  if (!data) {
    return context.redirect(`${paintsUrl}?error=${encodeURIComponent("Paint not found")}`);
  }

  return context.redirect(`${paintsUrl}?updated=1`);
};
