import React, { useState } from "react";
import { AlignLeft, ChevronDown, Droplet, Plus, Tag } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/auth/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { ColorField } from "@/components/entries/ColorField";
import { stepEditPath } from "@/lib/entry-steps-api";

interface EntryStepInlinePaintAddProps {
  entryId: string;
  stepId: string;
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

  const action = `/api/entries/${entryId}/paints`;
  const redirectTo = stepEditPath(entryId, stepId);
  return (
    <details
      className="group rounded-lg border border-white/10 bg-white/5"
      open={open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-blue-100/90 transition-colors marker:content-none hover:bg-white/5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Plus className="size-4 text-purple-300" />
          Add paint to entry
        </span>
        <ChevronDown className="size-4 text-blue-100/60 transition-transform group-open:rotate-180" />
      </summary>

      <form
        method="POST"
        action={action}
        className="space-y-4 border-t border-white/10 px-4 py-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <input type="hidden" name="redirect_to" value={redirectTo} />

        <FormField
          id={`inline-paint-name-${stepId}`}
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
          id={`inline-paint-brand-${stepId}`}
          name="brand"
          label="Brand"
          value={brand}
          onChange={setBrand}
          placeholder="e.g. Citadel"
          icon={<Tag className="size-4" />}
        />

        <TextareaField
          id={`inline-paint-color-desc-${stepId}`}
          name="color_description"
          label="Color description"
          value={colorDescription}
          onChange={setColorDescription}
          placeholder="Layer, wash, drybrush, etc."
          icon={<AlignLeft className="size-4" />}
          rows={2}
        />

        <ColorField
          id={`inline-paint-color-${stepId}`}
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
