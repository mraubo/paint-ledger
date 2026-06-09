import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toUserFacingDbError } from "@/lib/entries-api";
import { loadEntryPaints } from "@/lib/entry-paints-page";

async function filterValidPaintIds(
  supabase: SupabaseClient<Database>,
  entryId: string,
  submittedPaintIds: string[],
): Promise<{ ok: true; paintIds: string[] } | { ok: false; error: string }> {
  const paintsResult = await loadEntryPaints(supabase, entryId);
  if (!paintsResult.ok) {
    return { ok: false, error: paintsResult.error };
  }

  const validPaintIds = new Set(paintsResult.paints.map((paint) => paint.id));
  const paintIds = submittedPaintIds.filter((paintId) => validPaintIds.has(paintId));

  return { ok: true, paintIds };
}

export async function syncStepPaintAssignments(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepId: string,
  submittedPaintIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const filtered = await filterValidPaintIds(supabase, entryId, submittedPaintIds);
  if (!filtered.ok) {
    return filtered;
  }

  const { error } = await supabase.rpc("sync_step_paint_assignments", {
    p_entry_id: entryId,
    p_step_id: stepId,
    p_paint_ids: filtered.paintIds,
  });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true };
}

export async function updateStepWithAssignments(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepId: string,
  description: string,
  submittedPaintIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const filtered = await filterValidPaintIds(supabase, entryId, submittedPaintIds);
  if (!filtered.ok) {
    return filtered;
  }

  const { error } = await supabase.rpc("update_step_with_assignments", {
    p_entry_id: entryId,
    p_step_id: stepId,
    p_description: description,
    p_paint_ids: filtered.paintIds,
  });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true };
}

export async function createStepAtNextPosition(
  supabase: SupabaseClient<Database>,
  entryId: string,
  description: string,
): Promise<{ ok: true; stepId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("create_step_at_next_position", {
    p_entry_id: entryId,
    p_description: description,
  });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  if (!data) {
    return { ok: false, error: "Failed to create step" };
  }

  return { ok: true, stepId: data };
}

export async function deleteStepAndRenumber(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("delete_step_and_renumber", {
    p_entry_id: entryId,
    p_step_id: stepId,
  });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true };
}

export async function swapStepPositions(
  supabase: SupabaseClient<Database>,
  entryId: string,
  stepAId: string,
  stepBId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("swap_step_positions", {
    p_entry_id: entryId,
    p_step_a: stepAId,
    p_step_b: stepBId,
  });

  if (error) {
    return { ok: false, error: toUserFacingDbError(error) };
  }

  return { ok: true };
}
