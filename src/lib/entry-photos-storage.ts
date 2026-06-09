import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ENTRY_PHOTOS_BUCKET } from "@/lib/entry-photos-api";

export function toUserFacingStorageError(error: { message: string; statusCode?: string | number }): string {
  // eslint-disable-next-line no-console -- server-side diagnostic; user sees generic message only
  console.warn("Entry photo storage error:", error.statusCode ?? "unknown", error.message);
  return "Something went wrong uploading the photo. Please try again.";
}

function isNotFoundStorageError(error: { message?: string; statusCode?: string | number }): boolean {
  const status = String(error.statusCode ?? "");
  const message = (error.message ?? "").toLowerCase();
  return status === "404" || message.includes("not found") || message.includes("object not found");
}

export async function uploadEntryPhoto(
  supabase: SupabaseClient<Database>,
  path: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(ENTRY_PHOTOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { ok: false, error: toUserFacingStorageError(error) };
  }

  return { ok: true };
}

export async function deleteEntryPhoto(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(ENTRY_PHOTOS_BUCKET).remove([path]);

  if (error && !isNotFoundStorageError(error)) {
    return { ok: false, error: toUserFacingStorageError(error) };
  }

  return { ok: true };
}

export async function createSignedPhotoUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ENTRY_PHOTOS_BUCKET).createSignedUrl(path, expiresInSeconds);

  if (error) {
    // eslint-disable-next-line no-console -- server-side diagnostic
    console.warn("Entry photo signed URL error:", error.message);
    return null;
  }

  if (!data.signedUrl) {
    // eslint-disable-next-line no-console -- server-side diagnostic
    console.warn("Entry photo signed URL error: missing signedUrl");
    return null;
  }

  return data.signedUrl;
}
