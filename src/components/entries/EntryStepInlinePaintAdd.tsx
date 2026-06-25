import React, { useState } from "react";
import { AlignLeft, ChevronDown, Droplet, Plus, Tag } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/auth/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { ColorField } from "@/components/entries/ColorField";
import { stepEditPath, stepsPagePath } from "@/lib/entry-steps-api";

interface EntryStepInlinePaintAddProps {
  entryId: string;
  stepId?: string;
  serverError?: string | null;
  defaultOpen?: boolean;
}

export function EntryStepInlinePaintAdd({
  entryId,
  stepId,
  serverError,
  defaultOpen = false,
}: EntryStepInlinePaintAddProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [colorDescription, setColorDescription] = useState("");
  const [approximateColor, setApproximateColor] = useState("#000000");
  const [nameError, setNameError] = useState<string | undefined>();
  const [open, setOpen] = useState(defaultOpen || Boolean(serverError));

  function validate() {
    if (!name.trim()) {
      setNameError("Paint name is required");
      return false;
    }
    setNameError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const fieldPrefix = stepId ?? "add";
  const action = `/api/entries/${entryId}/paints`;
  const redirectTo = stepId ? stepEditPath(entryId, stepId) : stepsPagePath(entryId);

  return (
    <details
      className="border-border bg-card group rounded-lg border"
      open={open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary className="text-foreground hover:bg-accent flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Plus className="text-primary size-4" />
          Add paint to entry
        </span>
        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
      </summary>

      <form
        method="POST"
        action={action}
        className="border-border space-y-4 border-t px-4 py-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <input type="hidden" name="redirect_to" value={redirectTo} />

        <FormField
          id={`inline-paint-name-${fieldPrefix}`}
          name="name"
          label="Paint name"
          value={name}
          onChange={(v) => {
            setName(v);
            if (nameError) setNameError(undefined);
          }}
          placeholder="e.g. Macragge Blue"
          error={nameError}
          icon={<Droplet className="size-4" />}
        />

        <FormField
          id={`inline-paint-brand-${fieldPrefix}`}
          name="brand"
          label="Brand"
          value={brand}
          onChange={setBrand}
          placeholder="e.g. Citadel"
          icon={<Tag className="size-4" />}
        />

        <TextareaField
          id={`inline-paint-color-desc-${fieldPrefix}`}
          name="color_description"
          label="Color description"
          value={colorDescription}
          onChange={setColorDescription}
          placeholder="Layer, wash, drybrush, etc."
          icon={<AlignLeft className="size-4" />}
          rows={2}
        />

        <ColorField
          id={`inline-paint-color-${fieldPrefix}`}
          name="approximate_color"
          label="Approximate color"
          value={approximateColor}
          onChange={setApproximateColor}
        />

        <ServerError message={serverError} />

        <SubmitButton pendingText="Adding paint..." icon={<Plus className="size-4" />}>
          Add paint
        </SubmitButton>
      </form>
    </details>
  );
}
