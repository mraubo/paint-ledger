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

export function toEntrySummary(row: Pick<EntryRow, "id" | "title" | "status" | "updated_at">): EntrySummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    updated_at: row.updated_at,
  };
}
