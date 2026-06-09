import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toUserFacingDbError } from "@/lib/entries-api";
import {
  buildFinalPhotoPath,
  FINAL_PHOTO_FIELD,
  parseOptionalPhotoFile,
  parseRemovePhotoFlag,
  REMOVE_FINAL_PHOTO_FIELD,
} from "@/lib/entry-photos-api";
import { deleteEntryPhoto, uploadEntryPhoto } from "@/lib/entry-photos-storage";

async function loadFinalPhotoPath(
  supabase: SupabaseClient<Database>,
  entryId: string,
): Promise<{ ok: true; storagePath: string | null } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("entries").select("final_photo_path").eq("id", entryId).maybeSingle();

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true, storagePath: data?.final_photo_path ?? null };
}

export async function applyFinalPhotoFromForm(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryId: string,
  formData: FormData,
): Promise<{ ok: true; storagePath: string | null } | { ok: false; error: string }> {
  const parsedFile = parseOptionalPhotoFile(formData, FINAL_PHOTO_FIELD);
  if (!parsedFile.ok) {
    return parsedFile;
  }

  if (parsedFile.file) {
    const path = buildFinalPhotoPath(userId, entryId);
    const uploadResult = await uploadEntryPhoto(supabase, path, parsedFile.file);
    if (!uploadResult.ok) {
      return uploadResult;
    }

    const { error } = await supabase.from("entries").update({ final_photo_path: path }).eq("id", entryId);

    if (error) {
      await deleteEntryPhoto(supabase, path);
      return { ok: false, error: toUserFacingDbError(error) };
    }

    return { ok: true, storagePath: path };
  }

  if (parseRemovePhotoFlag(formData, REMOVE_FINAL_PHOTO_FIELD)) {
    const path = buildFinalPhotoPath(userId, entryId);
    const deleteResult = await deleteEntryPhoto(supabase, path);
    if (!deleteResult.ok) {
      return deleteResult;
    }

    const { error } = await supabase.from("entries").update({ final_photo_path: null }).eq("id", entryId);

    if (error) {
      return { ok: false, error: toUserFacingDbError(error) };
    }

    return { ok: true, storagePath: null };
  }

  return loadFinalPhotoPath(supabase, entryId);
}
