export const ENTRY_PHOTOS_BUCKET = "entry-photos";

export const ALLOWED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_PHOTO_BYTES = 4_194_304;

export const STEP_PHOTO_FIELD = "step_photo";
export const REMOVE_STEP_PHOTO_FIELD = "remove_step_photo";
export const FINAL_PHOTO_FIELD = "final_photo";
export const REMOVE_FINAL_PHOTO_FIELD = "remove_final_photo";

export function buildStepPhotoPath(userId: string, entryId: string, stepId: string): string {
  return `${userId}/${entryId}/steps/${stepId}`;
}

export function buildFinalPhotoPath(userId: string, entryId: string): string {
  return `${userId}/${entryId}/final`;
}

export function parseOptionalPhotoFile(
  formData: FormData,
  fieldName: string,
): { ok: true; file: File | null } | { ok: false; error: string } {
  if (!formData.has(fieldName)) {
    return { ok: true, file: null };
  }

  const value = formData.get(fieldName);
  if (value === null || value === "") {
    return { ok: true, file: null };
  }

  if (!(value instanceof File)) {
    return { ok: true, file: null };
  }

  if (value.size === 0) {
    return { ok: true, file: null };
  }

  if (!ALLOWED_PHOTO_MIME_TYPES.has(value.type)) {
    return { ok: false, error: "Photo must be JPEG, PNG, or WebP" };
  }

  if (value.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photo must be 4 MB or smaller" };
  }

  return { ok: true, file: value };
}

export function parseRemovePhotoFlag(formData: FormData, fieldName: string): boolean {
  const value = formData.get(fieldName);
  if (value === null) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "on" || normalized === "true";
  }

  return false;
}
