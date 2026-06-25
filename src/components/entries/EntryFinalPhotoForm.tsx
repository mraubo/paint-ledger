import { useState } from "react";
import { ImageIcon, Save } from "lucide-react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { FINAL_PHOTO_FIELD, REMOVE_FINAL_PHOTO_FIELD } from "@/lib/entry-photos-api";

interface EntryFinalPhotoFormProps {
  entryId: string;
  initialPhotoUrl?: string | null;
  serverError?: string | null;
}

export default function EntryFinalPhotoForm({ entryId, initialPhotoUrl, serverError }: EntryFinalPhotoFormProps) {
  const [removeChecked, setRemoveChecked] = useState(false);
  const hasExistingPhoto = Boolean(initialPhotoUrl);

  return (
    <form
      method="POST"
      action={`/api/entries/${entryId}/final-photo`}
      encType="multipart/form-data"
      className="space-y-4"
      noValidate
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Final result photo</legend>

        {initialPhotoUrl ? (
          <img
            src={initialPhotoUrl}
            alt="Current final result"
            className="border-border max-h-56 max-w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <ImageIcon className="size-4 shrink-0" />
            No final result photo yet
          </div>
        )}

        <div>
          <label htmlFor="final-photo" className="text-muted-foreground mb-1 block text-xs">
            {hasExistingPhoto ? "Replace photo" : "Upload photo"}
          </label>
          <input
            id="final-photo"
            type="file"
            name={FINAL_PHOTO_FIELD}
            accept="image/jpeg,image/png,image/webp"
            className="text-foreground file:bg-input file:text-foreground hover:file:bg-accent block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">JPEG, PNG, or WebP up to 4 MB</p>
        </div>

        {hasExistingPhoto ? (
          <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={REMOVE_FINAL_PHOTO_FIELD}
              value="1"
              checked={removeChecked}
              onChange={(e) => {
                setRemoveChecked(e.target.checked);
              }}
              className="border-border bg-input text-primary focus:ring-ring size-4 rounded border"
            />
            Remove photo
          </label>
        ) : null}
      </fieldset>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving photo..." icon={<Save className="size-4" />}>
        Save final photo
      </SubmitButton>
    </form>
  );
}
