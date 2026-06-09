import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EntryPaintFields } from "@/lib/entry-paints-api";

export interface EntryPaintRow extends EntryPaintFields {
  id: string;
}

export type EntryPaintsResult = { ok: true; paints: EntryPaintRow[] } | { ok: false; error: string };

export async function loadEntryPaints(supabase: SupabaseClient<Database>, entryId: string): Promise<EntryPaintsResult> {
  const { data, error } = await supabase
    .from("entry_paints")
    .select("id, name, brand, color_description, approximate_color")
    .eq("entry_id", entryId)
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, paints: data };
}

export async function loadEntryExists(supabase: SupabaseClient<Database>, entryId: string): Promise<boolean> {
  const { data, error } = await supabase.from("entries").select("id").eq("id", entryId).maybeSingle();

  return !error && Boolean(data);
}
