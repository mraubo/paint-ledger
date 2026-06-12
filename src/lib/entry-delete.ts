import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toUserFacingDbError } from "@/lib/entries-api";
import { deleteEntryPhoto } from "@/lib/entry-photos-storage";

export async function deleteEntryWithPhotos(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryId: string,
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const { data: entry, error: loadError } = await supabase
    .from("entries")
    .select("id, title, final_photo_path")
    .eq("id", entryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: toUserFacingDbError(loadError) };
  }

  if (!entry) {
    return { ok: false, error: "Entry not found" };
  }

  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select("storage_path")
    .eq("entry_id", entryId);

  if (stepsError) {
    return { ok: false, error: toUserFacingDbError(stepsError) };
  }

  const photoPaths = [
    ...steps.map((step) => step.storage_path).filter((path): path is string => Boolean(path)),
    ...(entry.final_photo_path ? [entry.final_photo_path] : []),
  ];

  for (const path of photoPaths) {
    const photoDeleteResult = await deleteEntryPhoto(supabase, path);
    if (!photoDeleteResult.ok) {
      // eslint-disable-next-line no-console -- best-effort cleanup before entry row removed
      console.warn("Failed to delete entry photo from storage:", path, photoDeleteResult.error);
    }
  }

  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("id, title")
    .maybeSingle();

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  if (!data) {
    return { ok: false, error: "Entry not found" };
  }

  return { ok: true, title: data.title };
}
