import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { deleteEntryWithPhotos } from "@/lib/entry-delete";
import { isValidEntryId, requireUser } from "@/lib/entries-api";

export const POST: APIRoute = async (context) => {
  const entryId = context.params.id;

  if (!entryId || !isValidEntryId(entryId)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/entries?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const deleteResult = await deleteEntryWithPhotos(supabase, user.id, entryId);
  if (!deleteResult.ok) {
    return context.redirect(`/entries?error=${encodeURIComponent(deleteResult.error)}`);
  }

  return context.redirect(`/entries?deleted=${encodeURIComponent(deleteResult.title)}`);
};
