import { CircleAlert, Palette } from "lucide-react";
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

  return (
    <div>
      <label htmlFor={`${id}-hex`} className="mb-1 block text-sm text-blue-100/80">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="size-10 shrink-0 rounded-lg border border-white/20"
          style={{ backgroundColor: swatchValue(value) }}
          aria-hidden
        />
        <input
          id={`${id}-picker`}
          type="color"
          value={pickerValue(value)}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="h-10 w-14 cursor-pointer rounded-lg border border-white/20 bg-transparent p-1"
          aria-label={`${label} picker`}
        />
        <div className="relative min-w-[8rem] flex-1">
          <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">
            <Palette className="size-4" />
          </span>
          <input
            id={`${id}-hex`}
            name={fieldName}
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            placeholder="#000000"
            className={cn(
              "w-full rounded-lg border bg-white/10 px-3 py-2 pl-10 text-white placeholder-white/40 focus:ring-2 focus:outline-none",
              error ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
            )}
          />
        </div>
      </div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-blue-100/50">
          Approximate swatch for this paint — not an exact match to the physical color.
        </p>
      )}
    </div>
  );
}
