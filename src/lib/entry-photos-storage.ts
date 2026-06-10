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
  const urlMap = await createSignedPhotoUrlMap(supabase, [path], expiresInSeconds);
  return urlMap.get(path) ?? null;
}

export async function createSignedPhotoUrlMap(
  supabase: SupabaseClient<Database>,
  paths: string[],
  expiresInSeconds: number,
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.storage
    .from(ENTRY_PHOTOS_BUCKET)
    .createSignedUrls(uniquePaths, expiresInSeconds);

  if (error) {
    // eslint-disable-next-line no-console -- server-side diagnostic
    console.warn("Entry photo signed URL batch error:", error.message);
    return new Map();
  }

  const urlMap = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) {
      urlMap.set(item.path, item.signedUrl);
    } else if (item.error) {
      // eslint-disable-next-line no-console -- server-side diagnostic
      console.warn("Entry photo signed URL error:", item.path ?? "unknown", item.error);
    }
  }

  return urlMap;
}
