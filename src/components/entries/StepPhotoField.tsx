import React, { useState } from "react";
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
      <legend className="mb-1 flex items-center gap-2 text-sm text-blue-100/80">
        <ImageIcon className="size-4" />
        Step photo <span className="text-blue-100/50">(optional)</span>
      </legend>

      {initialPhotoUrl ? (
        <img
          src={initialPhotoUrl}
          alt="Current step photo"
          className="max-h-40 max-w-full rounded-lg border border-white/20 object-cover"
        />
      ) : null}

      <div>
        <label htmlFor={`${fieldIdPrefix}-photo`} className="mb-1 block text-xs text-blue-100/60">
          {hasExistingPhoto ? "Replace photo" : "Upload photo"}
        </label>
        <input
          id={`${fieldIdPrefix}-photo`}
          type="file"
          name={STEP_PHOTO_FIELD}
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-blue-100/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
        />
        <p className="mt-1 text-xs text-blue-100/50">JPEG, PNG, or WebP up to 4 MB</p>
      </div>

      {hasExistingPhoto ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-blue-100/80">
          <input
            type="checkbox"
            name={REMOVE_STEP_PHOTO_FIELD}
            value="1"
            checked={removeChecked}
            onChange={(e) => {
              setRemoveChecked(e.target.checked);
            }}
            className="size-4 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-400"
          />
          Remove photo
        </label>
      ) : null}
    </fieldset>
  );
}
