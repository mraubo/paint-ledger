import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface EntryBasicsFields {
  title: string;
  description: string;
  model_info: string;
  model_origin_note: string;
}

export interface EntrySummary {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["entry_status"];
  updated_at: string;
}

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_FIELD_LENGTH = 10_000;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseEntryBasicsFormData(
  formData: FormData,
): { ok: true; fields: EntryBasicsFields } | { ok: false; error: string } {
  const fields: EntryBasicsFields = {
    title: readString(formData, "title").trim(),
    description: readString(formData, "description"),
    model_info: readString(formData, "model_info"),
    model_origin_note: readString(formData, "model_origin_note"),
  };

  if (!fields.title) {
    return { ok: false, error: "Title is required" };
  }

  if (fields.title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }

  if (fields.description.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Description must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  if (fields.model_info.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Model information must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  if (fields.model_origin_note.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Model origin note must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  return { ok: true, fields };
}

export async function requireUser(supabase: SupabaseClient<Database>): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export function isValidEntryId(id: string): boolean {
  return UUID_RE.test(id);
}

export function toUserFacingDbError(error: { message: string; code?: string }): string {
  // eslint-disable-next-line no-console -- server-side diagnostic; user sees generic message only
  console.warn("Entry DB error:", error.code ?? "unknown", error.message);
  return "Something went wrong. Please try again.";
}

export function toEntrySummary(row: Pick<EntryRow, "id" | "title" | "status" | "updated_at">): EntrySummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    updated_at: row.updated_at,
  };
}

export type EntryStatus = Database["public"]["Enums"]["entry_status"];

export function parseEntryStatusChange(
  formData: FormData,
): { ok: true; status: "draft" | "ready" } | { ok: false; error: string } {
  const value = readString(formData, "status");

  if (value === "draft" || value === "ready") {
    return { ok: true, status: value };
  }

  if (!value) {
    return { ok: false, error: "Status is required" };
  }

  return { ok: false, error: "Invalid status" };
}

export async function changeEntryStatus(
  supabase: SupabaseClient<Database>,
  entryId: string,
  userId: string,
  targetStatus: "draft" | "ready",
): Promise<{ ok: true; status: "draft" | "ready" } | { ok: false; error: string }> {
  const { data: entry, error: loadError } = await supabase
    .from("entries")
    .select("id, status, final_photo_path")
    .eq("id", entryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: toUserFacingDbError(loadError) };
  }

  if (!entry) {
    return { ok: false, error: "Entry not found" };
  }

  if (entry.status === targetStatus) {
    return { ok: false, error: `Entry is already ${targetStatus}` };
  }

  if (targetStatus === "ready" && !entry.final_photo_path) {
    return { ok: false, error: "Add a final result photo before marking this entry ready." };
  }

  const { data, error } = await supabase
    .from("entries")
    .update({ status: targetStatus })
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  if (!data) {
    return { ok: false, error: "Entry not found" };
  }

  return { ok: true, status: data.status };
}
