import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EntryBasicsFields } from "@/lib/entries-api";

export interface EntryListRow {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["entry_status"];
  updated_at: string;
}

export interface EntryBasicsRow extends EntryBasicsFields {
  id: string;
  status: Database["public"]["Enums"]["entry_status"];
}

export async function loadEntryList(supabase: SupabaseClient<Database>): Promise<EntryListRow[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data;
}

export async function loadEntryForEdit(supabase: SupabaseClient<Database>, id: string): Promise<EntryBasicsRow | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, description, model_info, model_origin_note, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export function formatEntryDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
