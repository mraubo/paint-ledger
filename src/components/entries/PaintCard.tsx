import { cn } from "@/lib/utils";
import { isValidHexColor } from "@/lib/entry-paints-api";

interface PaintCardProps {
  name: string;
  approximate_color: string;
  className?: string;
}

export function PaintCard({ name, approximate_color, className }: PaintCardProps) {
  const swatchColor = isValidHexColor(approximate_color) ? approximate_color : "#000000";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5",
        className,
      )}
    >
      <span
        className="size-6 shrink-0 rounded border border-white/20"
        style={{ backgroundColor: swatchColor }}
        aria-hidden="true"
      />
      <span className="text-sm text-white">{name}</span>
    </span>
  );
}
