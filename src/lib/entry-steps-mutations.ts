import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toUserFacingDbError } from "@/lib/entries-api";
import { loadEntryPaints } from "@/lib/entry-paints-page";

export async function syncStepPaintAssignments(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepId: string,
  submittedPaintIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const paintsResult = await loadEntryPaints(supabase, entryId);
  if (!paintsResult.ok) {
    return { ok: false, error: paintsResult.error };
  }

  const validPaintIds = new Set(paintsResult.paints.map((paint) => paint.id));
  const paintIds = submittedPaintIds.filter((paintId) => validPaintIds.has(paintId));

  const { error: deleteError } = await supabase.from("step_paint_assignments").delete().eq("step_id", stepId);

  if (deleteError) {
    return { ok: false, error: toUserFacingDbError(deleteError) };
  }

  if (paintIds.length === 0) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("step_paint_assignments").insert(
    paintIds.map((entry_paint_id) => ({
      step_id: stepId,
      entry_paint_id,
    })),
  );

  if (insertError) {
    return { ok: false, error: toUserFacingDbError(insertError) };
  }

  return { ok: true };
}

export async function renumberStepsAfterDelete(
  supabase: SupabaseClient<Database>,
  entryId: string,
  deletedPosition: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("steps")
    .select("id, position")
    .eq("entry_id", entryId)
    .gt("position", deletedPosition)
    .order("position", { ascending: true });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  for (const step of data) {
    const { error: updateError } = await supabase
      .from("steps")
      .update({ position: step.position - 1 })
      .eq("id", step.id)
      .eq("entry_id", entryId);

    if (updateError) {
      return { ok: false, error: toUserFacingDbError(updateError) };
    }
  }

  return { ok: true };
}

const TEMP_POSITION = -1;

export async function swapStepPositions(
  supabase: SupabaseClient<Database>,
  entryId: string,
  currentStepId: string,
  neighborStepId: string,
  currentPosition: number,
  neighborPosition: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: tempError } = await supabase
    .from("steps")
    .update({ position: TEMP_POSITION })
    .eq("id", currentStepId)
    .eq("entry_id", entryId);

  if (tempError) {
    return { ok: false, error: toUserFacingDbError(tempError) };
  }

  const { error: neighborError } = await supabase
    .from("steps")
    .update({ position: currentPosition })
    .eq("id", neighborStepId)
    .eq("entry_id", entryId);

  if (neighborError) {
    return { ok: false, error: toUserFacingDbError(neighborError) };
  }

  const { error: currentError } = await supabase
    .from("steps")
    .update({ position: neighborPosition })
    .eq("id", currentStepId)
    .eq("entry_id", entryId);

  if (currentError) {
    return { ok: false, error: toUserFacingDbError(currentError) };
  }

  return { ok: true };
}
