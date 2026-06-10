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

const PHOTO_HEADER_BYTES = 12;

function detectImageMimeFromHeader(header: Uint8Array): string | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    header.length >= 12 &&
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function parseOptionalPhotoFile(
  formData: FormData,
  fieldName: string,
): Promise<{ ok: true; file: File | null } | { ok: false; error: string }> {
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

  const header = new Uint8Array(await value.slice(0, PHOTO_HEADER_BYTES).arrayBuffer());
  const detectedMime = detectImageMimeFromHeader(header);
  if (!detectedMime || !ALLOWED_PHOTO_MIME_TYPES.has(detectedMime)) {
    return { ok: false, error: "Photo must be JPEG, PNG, or WebP" };
  }

  if (value.type !== detectedMime) {
    return { ok: false, error: "Photo file type does not match its contents" };
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
