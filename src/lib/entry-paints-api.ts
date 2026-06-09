import { isValidEntryId } from "@/lib/entries-api";

export interface EntryPaintFields {
  name: string;
  brand: string;
  color_description: string;
  approximate_color: string;
}

const MAX_NAME_LENGTH = 200;
const MAX_TEXT_FIELD_LENGTH = 10_000;
const DEFAULT_HEX_COLOR = "#000000";
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_HEX_COLOR;
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(withHash)) {
    return null;
  }

  return withHash.toLowerCase();
}

export function isValidPaintId(id: string): boolean {
  return isValidEntryId(id);
}

export function parseEntryPaintFormData(
  formData: FormData,
): { ok: true; fields: EntryPaintFields } | { ok: false; error: string } {
  const name = readString(formData, "name").trim();
  const brand = readString(formData, "brand");
  const color_description = readString(formData, "color_description");
  const rawColor = readString(formData, "approximate_color");

  if (!name) {
    return { ok: false, error: "Paint name is required" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Paint name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }

  if (brand.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Brand must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  if (color_description.length > MAX_TEXT_FIELD_LENGTH) {
    return { ok: false, error: `Color description must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  const approximate_color = normalizeHexColor(rawColor);
  if (!approximate_color) {
    return { ok: false, error: "Approximate color must be a valid hex value (e.g. #ff5500)" };
  }

  return {
    ok: true,
    fields: {
      name,
      brand,
      color_description,
      approximate_color,
    },
  };
}

export function paintsPagePath(entryId: string): string {
  return `/entries/${entryId}/paints`;
}
