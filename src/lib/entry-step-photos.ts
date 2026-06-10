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
  const parsedFile = await parseOptionalPhotoFile(formData, STEP_PHOTO_FIELD);
  if (!parsedFile.ok) {
    return parsedFile;
  }

  if (parsedFile.file) {
    const path = buildStepPhotoPath(userId, entryId, stepId);
    const priorPathResult = await loadStepStoragePath(supabase, entryId, stepId);
    if (!priorPathResult.ok) {
      return priorPathResult;
    }
    const hadPriorPhoto = priorPathResult.storagePath !== null;

    const uploadResult = await uploadEntryPhoto(supabase, path, parsedFile.file);
    if (!uploadResult.ok) {
      return uploadResult;
    }

    const { data, error } = await supabase
      .from("steps")
      .update({ storage_path: path })
      .eq("id", stepId)
      .eq("entry_id", entryId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (!hadPriorPhoto) {
        await deleteEntryPhoto(supabase, path);
      }
      return { ok: false, error: toUserFacingDbError(error) };
    }

    if (!data) {
      if (!hadPriorPhoto) {
        await deleteEntryPhoto(supabase, path);
      }
      return { ok: false, error: "Step not found" };
    }

    return { ok: true, storagePath: path };
  }

  if (parseRemovePhotoFlag(formData, REMOVE_STEP_PHOTO_FIELD)) {
    const path = buildStepPhotoPath(userId, entryId, stepId);

    const { data, error } = await supabase
      .from("steps")
      .update({ storage_path: null })
      .eq("id", stepId)
      .eq("entry_id", entryId)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: toUserFacingDbError(error) };
    }

    if (!data) {
      return { ok: false, error: "Step not found" };
    }

    const deleteResult = await deleteEntryPhoto(supabase, path);
    if (!deleteResult.ok) {
      // eslint-disable-next-line no-console -- best-effort cleanup; DB path already cleared
      console.warn("Failed to delete step photo from storage:", path, deleteResult.error);
    }

    return { ok: true, storagePath: null };
  }

  return loadStepStoragePath(supabase, entryId, stepId);
}
