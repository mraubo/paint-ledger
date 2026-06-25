import React, { useState } from "react";
import { AlignLeft, Droplet, Plus, Save, Tag } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/auth/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { ColorField } from "@/components/entries/ColorField";
import type { EntryPaintFields } from "@/lib/entry-paints-api";

interface AddProps {
  mode: "add";
  entryId: string;
  serverError?: string | null;
}

interface EditProps {
  mode: "edit";
  entryId: string;
  paintId: string;
  initialValues: EntryPaintFields;
  serverError?: string | null;
  cancelHref: string;
}

type Props = AddProps | EditProps;

const EMPTY_VALUES: EntryPaintFields = {
  name: "",
  brand: "",
  color_description: "",
  approximate_color: "#000000",
};

export default function EntryPaintForm(props: Props) {
  const serverError = props.serverError;
  const isEdit = props.mode === "edit";
  const initialValues = isEdit ? props.initialValues : EMPTY_VALUES;

  const [name, setName] = useState(initialValues.name);
  const [brand, setBrand] = useState(initialValues.brand);
  const [colorDescription, setColorDescription] = useState(initialValues.color_description);
  const [approximateColor, setApproximateColor] = useState(initialValues.approximate_color);
  const [nameError, setNameError] = useState<string | undefined>();

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

  const action = isEdit
    ? `/api/entries/${props.entryId}/paints/${props.paintId}`
    : `/api/entries/${props.entryId}/paints`;

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id={isEdit ? `paint-name-${props.paintId}` : "paint-name"}
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
        id={isEdit ? `paint-brand-${props.paintId}` : "paint-brand"}
        name="brand"
        label="Brand"
        value={brand}
        onChange={setBrand}
        placeholder="e.g. Citadel"
        icon={<Tag className="size-4" />}
      />

      <TextareaField
        id={isEdit ? `paint-color-desc-${props.paintId}` : "paint-color-desc"}
        name="color_description"
        label="Color description"
        value={colorDescription}
        onChange={setColorDescription}
        placeholder="Layer, wash, drybrush, etc."
        icon={<AlignLeft className="size-4" />}
        rows={2}
      />

      <ColorField
        id={isEdit ? `paint-color-${props.paintId}` : "paint-color"}
        name="approximate_color"
        label="Approximate color"
        value={approximateColor}
        onChange={setApproximateColor}
      />

      <ServerError message={serverError} />

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingText={isEdit ? "Saving..." : "Adding paint..."}
          icon={isEdit ? <Save className="size-4" /> : <Plus className="size-4" />}
        >
          {isEdit ? "Save paint" : "Add paint"}
        </SubmitButton>
        {isEdit ? (
          <a
            href={props.cancelHref}
            className="border-border text-foreground hover:bg-accent inline-flex items-center rounded-lg border px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
}
