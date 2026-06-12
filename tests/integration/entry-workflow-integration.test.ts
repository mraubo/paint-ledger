import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { updateStepWithAssignments } from "@/lib/entry-steps-mutations";
import { loadEntrySteps } from "@/lib/entry-steps-page";
import { ENTRY_A, PAINTS_A, STEPS_A, USER_A, USER_B } from "../helpers/seed-fixtures";
import { createTestClient, requireLocalSupabase, signInAs } from "../helpers/supabase-client";

type Client = SupabaseClient<Database>;

let clientA: Client;
let clientB: Client;

let entryBId: string;
let entryBPaintId: string;

async function assignmentsForStep(client: Client, stepId: string) {
  return client.from("step_paint_assignments").select("entry_paint_id").eq("step_id", stepId);
}

describe("paint assignment invariant (Risk #2)", () => {
  beforeAll(async () => {
    await requireLocalSupabase();
    clientA = createTestClient();
    clientB = createTestClient();
    await signInAs(clientA, USER_A.email, USER_A.password);
    await signInAs(clientB, USER_B.email, USER_B.password);

    const { data: entry, error: entryError } = await clientA
      .from("entries")
      .insert({
        user_id: USER_A.id,
        title: "Workflow test entry B",
        description: "Ephemeral entry for cross-entry paint invariant tests",
        model_info: "Test model",
        model_origin_note: "Test origin",
        status: "draft",
      })
      .select("id")
      .single();

    if (entryError) {
      throw new Error(`Failed to create ephemeral entry B: ${entryError.message}`);
    }

    entryBId = entry.id;

    const { data: paint, error: paintError } = await clientA
      .from("entry_paints")
      .insert({
        entry_id: entryBId,
        name: "Foreign entry paint",
        brand: "Test",
        color_description: "Must not assign to entry A steps",
        approximate_color: "#112233",
      })
      .select("id")
      .single();

    if (paintError) {
      throw new Error(`Failed to create ephemeral entry B paint: ${paintError.message}`);
    }

    entryBPaintId = paint.id;
  });

  afterAll(async () => {
    if (entryBId) {
      await clientA.from("entries").delete().eq("id", entryBId);
    }

    await clientA.from("step_paint_assignments").delete().eq("step_id", STEPS_A.layer);
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it("does not retain a bogus paint id after RPC sync", async () => {
    const bogusPaintId = randomUUID();

    const { error } = await clientA.rpc("sync_step_paint_assignments", {
      p_entry_id: ENTRY_A.id,
      p_step_id: STEPS_A.layer,
      p_paint_ids: [bogusPaintId],
    });

    expect(error).toBeNull();

    const { data, error: readError } = await assignmentsForStep(clientA, STEPS_A.layer);
    expect(readError).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("does not link a paint from another entry via RPC sync", async () => {
    const { error } = await clientA.rpc("sync_step_paint_assignments", {
      p_entry_id: ENTRY_A.id,
      p_step_id: STEPS_A.layer,
      p_paint_ids: [entryBPaintId],
    });

    expect(error).toBeNull();

    const { data, error: readError } = await assignmentsForStep(clientA, STEPS_A.layer);
    expect(readError).toBeNull();
    expect(data ?? []).toHaveLength(0);
    expect(data?.some((row) => row.entry_paint_id === entryBPaintId)).toBe(false);
  });

  it("rejects direct junction insert when step and paint belong to different entries", async () => {
    const { error } = await clientA.from("step_paint_assignments").insert({
      step_id: STEPS_A.prime,
      entry_paint_id: entryBPaintId,
    });

    expect(error).not.toBeNull();
  });

  it("assigns a valid entry paint via updateStepWithAssignments", async () => {
    const result = await updateStepWithAssignments(
      clientA,
      ENTRY_A.id,
      STEPS_A.layer,
      "Layer Imperial Fist over armor plates",
      [PAINTS_A.imperialFist],
    );

    expect(result.ok).toBe(true);

    const { data, error } = await assignmentsForStep(clientA, STEPS_A.layer);
    expect(error).toBeNull();
    expect(data?.map((row) => row.entry_paint_id)).toContain(PAINTS_A.imperialFist);

    const stepsResult = await loadEntrySteps(clientA, ENTRY_A.id);
    expect(stepsResult.ok).toBe(true);
    if (!stepsResult.ok) {
      return;
    }

    const layerStep = stepsResult.steps.find((step) => step.id === STEPS_A.layer);
    expect(layerStep?.assigned_paints.map((paint) => paint.id)).toContain(PAINTS_A.imperialFist);
  });

  it("keeps inline-added palette paints assignable to a step", async () => {
    const { data: newPaint, error: insertError } = await clientA
      .from("entry_paints")
      .insert({
        entry_id: ENTRY_A.id,
        name: "Workflow inline paint",
        brand: "Test",
        color_description: "Added in integration test",
        approximate_color: "#AABBCC",
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();
    expect(newPaint).not.toBeNull();
    if (!newPaint) {
      return;
    }

    const result = await updateStepWithAssignments(
      clientA,
      ENTRY_A.id,
      STEPS_A.layer,
      "Layer with inline-added paint",
      [newPaint.id],
    );

    expect(result.ok).toBe(true);

    const { data, error } = await assignmentsForStep(clientA, STEPS_A.layer);
    expect(error).toBeNull();
    expect(data?.map((row) => row.entry_paint_id)).toContain(newPaint.id);

    await clientA.from("step_paint_assignments").delete().eq("step_id", STEPS_A.layer);
    await clientA.from("entry_paints").delete().eq("id", newPaint.id);
  });
});
