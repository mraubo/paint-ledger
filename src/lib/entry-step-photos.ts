import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toUserFacingDbError } from "@/lib/entries-api";
import {
  buildStepPhotoPath,
  parseOptionalPhotoFile,
  parseRemovePhotoFlag,
  REMOVE_STEP_PHOTO_FIELD,
  STEP_PHOTO_FIELD,
} from "@/lib/entry-photos-api";
import { deleteEntryPhoto, uploadEntryPhoto } from "@/lib/entry-photos-storage";

async function loadStepStoragePath(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepId: string,
): Promise<{ ok: true; storagePath: string | null } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("steps")
    .select("storage_path")
    .eq("id", stepId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true, storagePath: data?.storage_path ?? null };
}

export async function applyStepPhotoFromForm(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryId: string,
  stepId: string,
  formData: FormData,
): Promise<{ ok: true; storagePath: string | null } | { ok: false; error: string }> {
  const parsedFile = parseOptionalPhotoFile(formData, STEP_PHOTO_FIELD);
  if (!parsedFile.ok) {
    return parsedFile;
  }

  if (parsedFile.file) {
    const path = buildStepPhotoPath(userId, entryId, stepId);
    const uploadResult = await uploadEntryPhoto(supabase, path, parsedFile.file);
    if (!uploadResult.ok) {
      return uploadResult;
    }

    const { error } = await supabase
      .from("steps")
      .update({ storage_path: path })
      .eq("id", stepId)
      .eq("entry_id", entryId);

    if (error) {
      await deleteEntryPhoto(supabase, path);
      return { ok: false, error: toUserFacingDbError(error) };
    }

    return { ok: true, storagePath: path };
  }

  if (parseRemovePhotoFlag(formData, REMOVE_STEP_PHOTO_FIELD)) {
    const path = buildStepPhotoPath(userId, entryId, stepId);
    const deleteResult = await deleteEntryPhoto(supabase, path);
    if (!deleteResult.ok) {
      return deleteResult;
    }

    const { error } = await supabase
      .from("steps")
      .update({ storage_path: null })
      .eq("id", stepId)
      .eq("entry_id", entryId);

    if (error) {
      return { ok: false, error: toUserFacingDbError(error) };
    }

    return { ok: true, storagePath: null };
  }

  return loadStepStoragePath(supabase, entryId, stepId);
}
