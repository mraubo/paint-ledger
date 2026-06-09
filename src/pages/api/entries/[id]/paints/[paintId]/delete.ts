import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, requireUser, toUserFacingDbError } from "@/lib/entries-api";
import { isValidPaintId, paintsPagePath } from "@/lib/entry-paints-api";

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

  const { data, error } = await supabase
    .from("entry_paints")
    .delete()
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

  return context.redirect(`${paintsUrl}?deleted=1`);
};
