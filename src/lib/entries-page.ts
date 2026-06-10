import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EntryBasicsFields } from "@/lib/entries-api";
import { createSignedPhotoUrl, createSignedPhotoUrlMap } from "@/lib/entry-photos-storage";

const SIGNED_PHOTO_URL_EXPIRY_SECONDS = 3600;

export interface EntryListRow {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["entry_status"];
  updated_at: string;
  photo_url: string | null;
  step_count: number;
}

export interface EntryBasicsRow extends EntryBasicsFields {
  id: string;
  status: Database["public"]["Enums"]["entry_status"];
  final_photo_path: string | null;
}

export type EntryDetailBasics = EntryBasicsRow;

export type EntryListResult = { ok: true; entries: EntryListRow[] } | { ok: false; error: string };

export async function loadEntryList(supabase: SupabaseClient<Database>): Promise<EntryListResult> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, status, updated_at, final_photo_path")
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const entryIds = data.map((row) => row.id);
  const stepCountByEntryId = new Map<string, number>(entryIds.map((entryId) => [entryId, 0]));

  if (entryIds.length > 0) {
    const countResults = await Promise.all(
      entryIds.map(async (entryId) => {
        const { count, error: countError } = await supabase
          .from("steps")
          .select("id", { count: "exact", head: true })
          .eq("entry_id", entryId);

        if (countError) {
          return { entryId, ok: false as const, error: countError.message };
        }

        return { entryId, ok: true as const, count: count ?? 0 };
      }),
    );

    const failed = countResults.find((result): result is { entryId: string; ok: false; error: string } => !result.ok);
    if (failed) {
      return { ok: false, error: failed.error };
    }

    for (const result of countResults) {
      if (result.ok) {
        stepCountByEntryId.set(result.entryId, result.count);
      }
    }
  }

  const photoPaths = data.flatMap((row) => (row.final_photo_path ? [row.final_photo_path] : []));
  const signedPhotoUrls = await createSignedPhotoUrlMap(supabase, photoPaths, SIGNED_PHOTO_URL_EXPIRY_SECONDS);

  const entries = data.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    updated_at: row.updated_at,
    photo_url: row.final_photo_path ? (signedPhotoUrls.get(row.final_photo_path) ?? null) : null,
    step_count: stepCountByEntryId.get(row.id) ?? 0,
  }));

  return { ok: true, entries };
}

export function formatStepCount(count: number): string {
  return count === 1 ? "1 step" : `${count} steps`;
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
