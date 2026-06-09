import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

  const steps = (data as StepWithAssignments[]).map((step) => {
    const assigned_paints = (step.step_paint_assignments ?? [])
      .map((assignment) => assignment.entry_paints)
      .filter((paint): paint is AssignedPaintSummary => paint !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: step.id,
      entry_id: step.entry_id,
      position: step.position,
      description: step.description,
      created_at: step.created_at,
      updated_at: step.updated_at,
      assigned_paints,
    };
  });

  return { ok: true, steps };
}
