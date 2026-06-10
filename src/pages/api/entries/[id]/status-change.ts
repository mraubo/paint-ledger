import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { changeEntryStatus, isValidEntryId, parseEntryStatusChange, requireUser } from "@/lib/entries-api";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id || !isValidEntryId(id)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const editUrl = `/entries/${id}/edit`;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`${editUrl}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = parseEntryStatusChange(form);
  if (!parsed.ok) {
    return context.redirect(`${editUrl}?error=${encodeURIComponent(parsed.error)}`);
  }

  const result = await changeEntryStatus(supabase, id, user.id, parsed.status);
  if (!result.ok) {
    return context.redirect(`${editUrl}?error=${encodeURIComponent(result.error)}`);
  }

  return context.redirect(`${editUrl}?status_changed=${result.status}`);
};
