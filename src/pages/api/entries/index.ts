import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { parseEntryBasicsFormData, requireUser } from "@/lib/entries-api";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/entries/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = await requireUser(supabase);
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = parseEntryBasicsFormData(form);
  if (!parsed.ok) {
    return context.redirect(`/entries/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const { fields } = parsed;
  const { data, error } = await supabase
    .from("entries")
    .insert({
      title: fields.title,
      description: fields.description,
      model_info: fields.model_info,
      model_origin_note: fields.model_origin_note,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return context.redirect(`/entries/new?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect(`/entries?created=${data.id}`);
};
