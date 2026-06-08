import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidEntryId, parseEntryBasicsFormData, requireUser } from "@/lib/entries-api";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id || !isValidEntryId(id)) {
    return context.redirect(`/entries?error=${encodeURIComponent("Invalid entry id")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/entries/${id}?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = parseEntryBasicsFormData(form);
  if (!parsed.ok) {
    return context.redirect(`/entries/${id}?error=${encodeURIComponent(parsed.error)}`);
  }

  const { fields } = parsed;
  const { error } = await supabase
    .from("entries")
    .update({
      title: fields.title,
      description: fields.description,
      model_info: fields.model_info,
      model_origin_note: fields.model_origin_note,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return context.redirect(`/entries/${id}?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect(`/entries/${id}?saved=1`);
};
