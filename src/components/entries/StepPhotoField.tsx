import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { REMOVE_STEP_PHOTO_FIELD, STEP_PHOTO_FIELD } from "@/lib/entry-photos-api";

interface StepPhotoFieldProps {
  fieldIdPrefix: string;
  initialPhotoUrl?: string | null;
  hasExistingPhoto: boolean;
}

export function StepPhotoField({ fieldIdPrefix, initialPhotoUrl, hasExistingPhoto }: StepPhotoFieldProps) {
  const [removeChecked, setRemoveChecked] = useState(false);

  return (
    <fieldset className="space-y-3">
      <legend className="text-foreground mb-1 flex items-center gap-2 text-sm">
        <ImageIcon className="size-4" />
        Step photo <span className="text-muted-foreground">(optional)</span>
      </legend>

      {initialPhotoUrl ? (
        <img
          src={initialPhotoUrl}
          alt="Current step photo"
          className="border-border max-h-40 max-w-full rounded-lg border object-cover"
        />
      ) : null}

      <div>
        <label htmlFor={`${fieldIdPrefix}-photo`} className="text-muted-foreground mb-1 block text-xs">
          {hasExistingPhoto ? "Replace photo" : "Upload photo"}
        </label>
        <input
          id={`${fieldIdPrefix}-photo`}
          type="file"
          name={STEP_PHOTO_FIELD}
          accept="image/jpeg,image/png,image/webp"
          className="text-foreground file:bg-input file:text-foreground hover:file:bg-accent block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm"
        />
        <p className="text-muted-foreground mt-1 text-xs">JPEG, PNG, or WebP up to 4 MB</p>
      </div>

      {hasExistingPhoto ? (
        <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={REMOVE_STEP_PHOTO_FIELD}
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
  );
}
