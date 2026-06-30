import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidHexColor, normalizeHexColor } from "@/lib/entry-paints-api";

interface ColorFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function pickerValue(value: string): string {
  const normalized = normalizeHexColor(value);
  return normalized ?? "#000000";
}

function swatchValue(value: string): string {
  if (isValidHexColor(value)) {
    return value;
  }
  const normalized = normalizeHexColor(value);
  return normalized ?? "#000000";
}

export function ColorField({ id, name, label, value, onChange, error }: ColorFieldProps) {
  const fieldName = name ?? id;

  function handlePickerUpdate(raw: string) {
    const normalized = normalizeHexColor(raw);
    if (normalized) {
      onChange(normalized);
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-hex`} className="text-foreground mb-1 block text-sm">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={`${id}-picker`}
          type="color"
          value={pickerValue(value)}
          onInput={(e) => {
            handlePickerUpdate(e.currentTarget.value);
          }}
          onChange={(e) => {
            handlePickerUpdate(e.currentTarget.value);
          }}
          className="border-border bg-input h-10 w-14 cursor-pointer rounded-lg border p-1"
          aria-label={`${label} picker`}
        />
        <div className="relative min-w-[8rem] flex-1">
          <span
            className="border-border absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded border"
            style={{ backgroundColor: swatchValue(value) }}
            aria-hidden="true"
          />
          <input
            id={`${id}-hex`}
            name={fieldName}
            type="text"
            value={value}
            onInput={(e) => {
              onChange(e.currentTarget.value);
            }}
            onChange={(e) => {
              onChange(e.currentTarget.value);
            }}
            placeholder="#000000"
            className={cn(
              "border-border bg-input text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 pl-10 focus:ring-2 focus:outline-none",
              error && "border-destructive focus:ring-destructive/30",
            )}
          />
        </div>
      </div>
      {error ? (
        <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          Approximate swatch for this paint — not an exact match to the physical color.
        </p>
      )}
    </div>
  );
}
