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
  const parsedFile = await parseOptionalPhotoFile(formData, FINAL_PHOTO_FIELD);
  if (!parsedFile.ok) {
    return parsedFile;
  }

  if (parsedFile.file) {
    const path = buildFinalPhotoPath(userId, entryId);
    const priorPathResult = await loadFinalPhotoPath(supabase, entryId);
    if (!priorPathResult.ok) {
      return priorPathResult;
    }
    const hadPriorPhoto = priorPathResult.storagePath !== null;

    const uploadResult = await uploadEntryPhoto(supabase, path, parsedFile.file);
    if (!uploadResult.ok) {
      return uploadResult;
    }

    const { data, error } = await supabase
      .from("entries")
      .update({ final_photo_path: path })
      .eq("id", entryId)
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
      return { ok: false, error: "Entry not found" };
    }

    return { ok: true, storagePath: path };
  }

  if (parseRemovePhotoFlag(formData, REMOVE_FINAL_PHOTO_FIELD)) {
    const path = buildFinalPhotoPath(userId, entryId);

    const { data, error } = await supabase
      .from("entries")
      .update({ final_photo_path: null })
      .eq("id", entryId)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: toUserFacingDbError(error) };
    }

    if (!data) {
      return { ok: false, error: "Entry not found" };
    }

    const deleteResult = await deleteEntryPhoto(supabase, path);
    if (!deleteResult.ok) {
      // eslint-disable-next-line no-console -- best-effort cleanup; DB path already cleared
      console.warn("Failed to delete final photo from storage:", path, deleteResult.error);
    }

    return { ok: true, storagePath: null };
  }

  return loadFinalPhotoPath(supabase, entryId);
}
