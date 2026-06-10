import React, { useState } from "react";
import { AlignLeft, Plus, Save } from "lucide-react";
import { TextareaField } from "@/components/auth/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { EntryStepInlinePaintAdd } from "@/components/entries/EntryStepInlinePaintAdd";
import { StepPhotoField } from "@/components/entries/StepPhotoField";
import { isValidHexColor } from "@/lib/entry-paints-api";
import type { EntryPaintRow } from "@/lib/entry-paints-page";

interface SharedProps {
  entryId: string;
  entryPaints: EntryPaintRow[];
  paintAddedId?: string | null;
  initialPhotoUrl?: string | null;
  serverError?: string | null;
  inlinePaintError?: string | null;
}

interface AddProps extends SharedProps {
  mode: "add";
}

interface EditProps extends SharedProps {
  mode: "edit";
  stepId: string;
  initialDescription: string;
  assignedPaintIds: string[];
  cancelHref: string;
}

type Props = AddProps | EditProps;

function buildInitialSelectedPaintIds(assignedPaintIds: string[], paintAddedId?: string | null): Set<string> {
  const selected = new Set(assignedPaintIds);
  if (paintAddedId) {
    selected.add(paintAddedId);
  }
  return selected;
}

function paintMetaLabel(paint: EntryPaintRow): string | null {
  const metaParts = [paint.brand, paint.color_description].filter((part) => part.trim().length > 0);
  return metaParts.length > 0 ? metaParts.join(" · ") : null;
}

interface PaintChecklistProps {
  entryId: string;
  entryPaints: EntryPaintRow[];
  selectedPaintIds: Set<string>;
  onTogglePaint: (paintId: string, checked: boolean) => void;
}

function PaintChecklist({ entryId, entryPaints, selectedPaintIds, onTogglePaint }: PaintChecklistProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 block text-sm text-blue-100/80">Assigned paints</legend>
      {entryPaints.length === 0 ? (
        <p className="text-sm text-blue-100/60">
          No paints on this entry yet. Add one below or on the{" "}
          <a href={`/entries/${entryId}/paints`} className="text-purple-300 hover:underline">
            paints page
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {entryPaints.map((paint) => {
            const meta = paintMetaLabel(paint);
            const swatchColor = isValidHexColor(paint.approximate_color) ? paint.approximate_color : "#000000";
            const checked = selectedPaintIds.has(paint.id);

            return (
              <li key={paint.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                  <input
                    type="checkbox"
                    name="entry_paint_ids"
                    value={paint.id}
                    checked={checked}
                    onChange={(e) => {
                      onTogglePaint(paint.id, e.target.checked);
                    }}
                    className="mt-1 size-4 shrink-0 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-400"
                  />
                  <span
                    className="mt-0.5 size-8 shrink-0 rounded border border-white/20"
                    style={{ backgroundColor: swatchColor }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{paint.name}</span>
                    {meta ? <span className="block text-xs text-blue-100/60">{meta}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

export default function EntryStepForm(props: Props) {
  const isEdit = props.mode === "edit";
  const serverError = props.serverError;
  const fieldPrefix = isEdit ? props.stepId : "add";

  const [description, setDescription] = useState(isEdit ? props.initialDescription : "");
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [selectedPaintIds, setSelectedPaintIds] = useState<Set<string>>(() =>
    isEdit
      ? buildInitialSelectedPaintIds(props.assignedPaintIds, props.paintAddedId)
      : buildInitialSelectedPaintIds([], props.paintAddedId),
  );

  function validate() {
    if (!description.trim()) {
      setDescriptionError("Step description is required");
      return false;
    }
    setDescriptionError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  function togglePaint(paintId: string, checked: boolean) {
    setSelectedPaintIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(paintId);
      } else {
        next.delete(paintId);
      }
      return next;
    });
  }

  const action = isEdit ? `/api/entries/${props.entryId}/steps/${props.stepId}` : `/api/entries/${props.entryId}/steps`;
  const descriptionFieldId = isEdit ? `step-description-${props.stepId}` : "step-description";
  const hasExistingPhoto = Boolean(props.initialPhotoUrl);

  return (
    <div className="space-y-6">
      <form
        method="POST"
        action={action}
        encType="multipart/form-data"
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        {isEdit ? <input type="hidden" name="return_to_edit" value="1" /> : null}

        <TextareaField
          id={descriptionFieldId}
          name="description"
          label="Step description"
          value={description}
          onChange={(v) => {
            setDescription(v);
            if (descriptionError) setDescriptionError(undefined);
          }}
          placeholder="Describe what to paint in this step..."
          error={descriptionError}
          icon={<AlignLeft className="size-4" />}
          rows={4}
        />

        <PaintChecklist
          entryId={props.entryId}
          entryPaints={props.entryPaints}
          selectedPaintIds={selectedPaintIds}
          onTogglePaint={togglePaint}
        />

        <StepPhotoField
          fieldIdPrefix={fieldPrefix}
          initialPhotoUrl={props.initialPhotoUrl}
          hasExistingPhoto={hasExistingPhoto}
        />

        <ServerError message={serverError} />

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pendingText={isEdit ? "Saving..." : "Adding step..."}
            icon={isEdit ? <Save className="size-4" /> : <Plus className="size-4" />}
          >
            {isEdit ? "Save step" : "Add step"}
          </SubmitButton>
          {isEdit ? (
            <a
              href={props.cancelHref}
              className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm text-blue-100/80 transition-colors hover:bg-white/10"
            >
              Cancel
            </a>
          ) : null}
        </div>
      </form>

      <EntryStepInlinePaintAdd
        entryId={props.entryId}
        stepId={isEdit ? props.stepId : undefined}
        serverError={props.inlinePaintError}
        defaultOpen={props.entryPaints.length === 0}
      />
    </div>
  );
}
