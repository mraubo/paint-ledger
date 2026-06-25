import React, { useState } from "react";
import { AlignLeft, Box, FileText, MapPin, Plus, Save } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/auth/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import type { EntryBasicsFields } from "@/lib/entries-api";

const MODEL_ORIGIN_HINT = (
  <p className="text-muted-foreground mt-1 text-xs">STL source, shop, producer, link, or where to find files on disk</p>
);

interface CreateProps {
  mode: "create";
  serverError?: string | null;
}

interface EditProps {
  mode: "edit";
  entryId: string;
  initialValues: EntryBasicsFields;
  serverError?: string | null;
}

type Props = CreateProps | EditProps;

const EMPTY_VALUES: EntryBasicsFields = {
  title: "",
  description: "",
  model_info: "",
  model_origin_note: "",
};

export default function EntryBasicsForm(props: Props) {
  const serverError = props.serverError;
  const isEdit = props.mode === "edit";
  const initialValues = isEdit ? props.initialValues : EMPTY_VALUES;

  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [modelInfo, setModelInfo] = useState(initialValues.model_info);
  const [modelOriginNote, setModelOriginNote] = useState(initialValues.model_origin_note);
  const [titleError, setTitleError] = useState<string | undefined>();

  function validate() {
    if (!title.trim()) {
      setTitleError("Title is required");
      return false;
    }
    setTitleError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const action = isEdit ? `/api/entries/${props.entryId}` : "/api/entries";

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="title"
        label="Title"
        value={title}
        onChange={(v) => {
          setTitle(v);
          if (titleError) setTitleError(undefined);
        }}
        placeholder="e.g. Space Marine Captain"
        error={titleError}
        icon={<FileText className="size-4" />}
      />

      <TextareaField
        id="description"
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Short notes about this paint log"
        icon={<AlignLeft className="size-4" />}
      />

      <FormField
        id="model_info"
        label="Model information"
        value={modelInfo}
        onChange={setModelInfo}
        placeholder="Scale, faction, sculptor, etc."
        icon={<Box className="size-4" />}
      />

      <TextareaField
        id="model_origin_note"
        label="Model origin note"
        value={modelOriginNote}
        onChange={setModelOriginNote}
        placeholder="Where the model came from"
        hint={MODEL_ORIGIN_HINT}
        icon={<MapPin className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton
        pendingText={isEdit ? "Saving..." : "Creating entry..."}
        icon={isEdit ? <Save className="size-4" /> : <Plus className="size-4" />}
      >
        {isEdit ? "Save changes" : "Create entry"}
      </SubmitButton>
    </form>
  );
}
