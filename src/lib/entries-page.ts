import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EntryBasicsFields } from "@/lib/entries-api";
import { createSignedPhotoUrl } from "@/lib/entry-photos-storage";

const SIGNED_PHOTO_URL_EXPIRY_SECONDS = 3600;

export interface EntryListRow {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["entry_status"];
  updated_at: string;
  photo_url: string | null;
}

export interface EntryBasicsRow extends EntryBasicsFields {
  id: string;
  status: Database["public"]["Enums"]["entry_status"];
  final_photo_path: string | null;
}

export type EntryListResult = { ok: true; entries: EntryListRow[] } | { ok: false; error: string };

export async function loadEntryList(supabase: SupabaseClient<Database>): Promise<EntryListResult> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, status, updated_at, final_photo_path")
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const entries = await Promise.all(
    data.map(async (row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updated_at: row.updated_at,
      photo_url: await resolveEntryFinalPhotoUrl(supabase, row.final_photo_path),
    })),
  );

  return { ok: true, entries };
}

export async function loadEntryForEdit(supabase: SupabaseClient<Database>, id: string): Promise<EntryBasicsRow | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, description, model_info, model_origin_note, status, final_photo_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function resolveEntryFinalPhotoUrl(
  supabase: SupabaseClient<Database>,
  finalPhotoPath: string | null,
): Promise<string | null> {
  if (!finalPhotoPath) {
    return null;
  }

  return createSignedPhotoUrl(supabase, finalPhotoPath, SIGNED_PHOTO_URL_EXPIRY_SECONDS);
}

export function formatEntryDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
