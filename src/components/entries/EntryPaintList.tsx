import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import EntryPaintForm from "@/components/entries/EntryPaintForm";
import type { EntryPaintFields } from "@/lib/entry-paints-api";

export interface EntryPaintRow extends EntryPaintFields {
  id: string;
}

interface EntryPaintListProps {
  entryId: string;
  paints: EntryPaintRow[];
  serverError?: string | null;
}

function PaintMeta({ brand, colorDescription }: { brand: string; colorDescription: string }) {
  const parts = [brand, colorDescription].filter((part) => part.trim().length > 0);
  if (parts.length === 0) {
    return null;
  }
  return <p className="text-sm text-blue-100/60">{parts.join(" · ")}</p>;
}

export default function EntryPaintList({ entryId, paints, serverError }: EntryPaintListProps) {
  const [expandedPaintId, setExpandedPaintId] = useState<string | null>(null);

  if (paints.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {paints.map((paint) => {
        const isEditing = expandedPaintId === paint.id;

        return (
          <li key={paint.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            {isEditing ? (
              <EntryPaintForm
                mode="edit"
                entryId={entryId}
                paintId={paint.id}
                initialValues={{
                  name: paint.name,
                  brand: paint.brand,
                  color_description: paint.color_description,
                  approximate_color: paint.approximate_color,
                }}
                serverError={serverError}
                onCancel={() => {
                  setExpandedPaintId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <span
                  className="mt-0.5 size-10 shrink-0 rounded-lg border border-white/20"
                  style={{ backgroundColor: paint.approximate_color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{paint.name}</p>
                  <PaintMeta brand={paint.brand} colorDescription={paint.color_description} />
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedPaintId(paint.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-blue-100/80 transition-colors hover:bg-white/10"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                  <form
                    method="POST"
                    action={`/api/entries/${entryId}/paints/${paint.id}/delete`}
                    onSubmit={(e) => {
                      if (!confirm("Delete this paint?")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-1.5 text-sm text-red-200/90 transition-colors hover:bg-red-900/20"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
