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
      className={cn("border-border bg-card inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5", className)}
    >
      <span
        className="border-border size-6 shrink-0 rounded-full border"
        style={{ backgroundColor: swatchColor }}
        aria-hidden="true"
      />
      <span className="text-foreground font-mono text-sm">{name}</span>
    </span>
  );
}
