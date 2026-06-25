import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const textareaBase =
  "w-full min-h-[5rem] resize-y rounded-lg border border-border bg-input px-3 py-2 pl-10 text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

interface TextareaFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  rows?: number;
}

export function TextareaField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  rows = 3,
}: TextareaFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-foreground mb-1 block text-sm">
        {label}
      </label>
      <div className="relative">
        <span className="text-muted-foreground absolute top-3 left-3">{icon}</span>
        <textarea
          id={id}
          name={name ?? id}
          value={value}
          rows={rows}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(textareaBase, error && "border-destructive focus:border-destructive focus:ring-destructive/30")}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
