import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createSignedPhotoUrl } from "@/lib/entry-photos-storage";

const SIGNED_PHOTO_URL_EXPIRY_SECONDS = 3600;

export interface AssignedPaintSummary {
  id: string;
  name: string;
  approximate_color: string;
}

export interface EntryStepRow {
  id: string;
  entry_id: string;
  position: number;
  description: string;
  storage_path: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  assigned_paints: AssignedPaintSummary[];
}

export type EntryStepsResult = { ok: true; steps: EntryStepRow[] } | { ok: false; error: string };

interface StepAssignmentRow {
  entry_paint_id: string;
  entry_paints: {
    id: string;
    name: string;
    approximate_color: string;
  } | null;
}

interface StepWithAssignments {
  id: string;
  entry_id: string;
  position: number;
  description: string;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
  step_paint_assignments: StepAssignmentRow[] | null;
}

export async function loadEntrySteps(supabase: SupabaseClient<Database>, entryId: string): Promise<EntryStepsResult> {
  const { data, error } = await supabase
    .from("steps")
    .select(
      `
      id,
      entry_id,
      position,
      description,
      storage_path,
      created_at,
      updated_at,
      step_paint_assignments (
        entry_paint_id,
        entry_paints (
          id,
          name,
          approximate_color
        )
      )
    `,
    )
    .eq("entry_id", entryId)
    .order("position", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const steps = await Promise.all(
    (data as StepWithAssignments[]).map(async (step) => {
      const assigned_paints = (step.step_paint_assignments ?? [])
        .map((assignment) => assignment.entry_paints)
        .filter((paint): paint is AssignedPaintSummary => paint !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      const photo_url = step.storage_path
        ? await createSignedPhotoUrl(supabase, step.storage_path, SIGNED_PHOTO_URL_EXPIRY_SECONDS)
        : null;

      return {
        id: step.id,
        entry_id: step.entry_id,
        position: step.position,
        description: step.description,
        storage_path: step.storage_path,
        photo_url,
        created_at: step.created_at,
        updated_at: step.updated_at,
        assigned_paints,
      };
    }),
  );

  return { ok: true, steps };
}
