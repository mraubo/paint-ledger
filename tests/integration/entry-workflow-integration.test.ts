import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { deleteEntryWithPhotos } from "@/lib/entry-delete";
import { loadEntryForEdit, resolveEntryFinalPhotoUrl } from "@/lib/entries-page";
import { loadEntryPaints } from "@/lib/entry-paints-page";
import { buildFinalPhotoPath, buildStepPhotoPath, ENTRY_PHOTOS_BUCKET } from "@/lib/entry-photos-api";
import { createSignedPhotoUrl, createSignedPhotoUrlMap, uploadEntryPhoto } from "@/lib/entry-photos-storage";
import { syncStepPaintAssignments, updateStepWithAssignments } from "@/lib/entry-steps-mutations";
import { loadEntrySteps } from "@/lib/entry-steps-page";
import { createMinimalPngFile } from "../helpers/test-image";
import { ENTRY_A, PAINTS_A, STEPS_A, USER_A, USER_B } from "../helpers/seed-fixtures";
import { createTestClient, requireLocalSupabase, signInAs } from "../helpers/supabase-client";

type Client = SupabaseClient<Database>;

let clientA: Client;
let clientB: Client;

let entryBId: string;
let entryBPaintId: string;

const uploadedPhotoPaths: string[] = [];

async function assignmentsForStep(client: Client, stepId: string) {
  return client.from("step_paint_assignments").select("entry_paint_id").eq("step_id", stepId);
}

async function persistStepPhotoPath(client: Client, entryId: string, stepId: string, path: string) {
  const { error } = await client.from("steps").update({ storage_path: path }).eq("id", stepId).eq("entry_id", entryId);

  if (error) {
    throw new Error(`Failed to persist step photo path: ${error.message}`);
  }
}

async function persistFinalPhotoPath(client: Client, entryId: string, path: string) {
  const { error } = await client.from("entries").update({ final_photo_path: path }).eq("id", entryId);

  if (error) {
    throw new Error(`Failed to persist final photo path: ${error.message}`);
  }
}

async function clearStepPhoto(client: Client, entryId: string, stepId: string) {
  const { error } = await client.from("steps").update({ storage_path: null }).eq("id", stepId).eq("entry_id", entryId);

  if (error) {
    throw new Error(`Failed to clear step photo path: ${error.message}`);
  }
}

async function clearFinalPhoto(client: Client, entryId: string) {
  const { error } = await client.from("entries").update({ final_photo_path: null }).eq("id", entryId);

  if (error) {
    throw new Error(`Failed to clear final photo path: ${error.message}`);
  }
}

beforeAll(async () => {
  await requireLocalSupabase();
  clientA = createTestClient();
  clientB = createTestClient();
  await signInAs(clientA, USER_A.email, USER_A.password);
  await signInAs(clientB, USER_B.email, USER_B.password);
});

afterAll(async () => {
  if (uploadedPhotoPaths.length > 0) {
    const { error } = await clientA.storage.from(ENTRY_PHOTOS_BUCKET).remove(uploadedPhotoPaths);

    if (error) {
      throw new Error(`Failed to remove uploaded test photos: ${error.message}`);
    }
  }

  await clearStepPhoto(clientA, ENTRY_A.id, STEPS_A.prime);
  await clearFinalPhoto(clientA, ENTRY_A.id);
  await clientA.auth.signOut();
  await clientB.auth.signOut();
});

describe("paint assignment invariant (Risk #2)", () => {
  beforeAll(async () => {
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
      const { error: deleteEntryError } = await clientA.from("entries").delete().eq("id", entryBId);

      if (deleteEntryError) {
        throw new Error(`Failed to delete ephemeral entry B: ${deleteEntryError.message}`);
      }
    }

    const { error: deleteAssignmentsError } = await clientA
      .from("step_paint_assignments")
      .delete()
      .eq("step_id", STEPS_A.layer);

    if (deleteAssignmentsError) {
      throw new Error(`Failed to reset step assignments: ${deleteAssignmentsError.message}`);
    }

    const { error: resetStepError } = await clientA
      .from("steps")
      .update({ description: "Layer Imperial Fist over armor plates" })
      .eq("id", STEPS_A.layer)
      .eq("entry_id", ENTRY_A.id);

    if (resetStepError) {
      throw new Error(`Failed to reset step description: ${resetStepError.message}`);
    }
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

  it("does not link a paint from another entry via updateStepWithAssignments", async () => {
    const result = await updateStepWithAssignments(
      clientA,
      ENTRY_A.id,
      STEPS_A.layer,
      "Layer Imperial Fist over armor plates",
      [entryBPaintId],
    );

    expect(result.ok).toBe(true);

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
    let newPaintId: string | null = null;

    try {
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

      newPaintId = newPaint.id;

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
    } finally {
      if (newPaintId) {
        await clientA.from("step_paint_assignments").delete().eq("step_id", STEPS_A.layer);
        await clientA.from("entry_paints").delete().eq("id", newPaintId);
      }
    }
  });
});

describe("photo recall (Risk #4)", () => {
  it("resolves a fetchable signed URL for an owner-uploaded step photo", async () => {
    const path = buildStepPhotoPath(USER_A.id, ENTRY_A.id, STEPS_A.prime);
    const file = createMinimalPngFile();

    const uploadResult = await uploadEntryPhoto(clientA, path, file);
    expect(uploadResult.ok).toBe(true);
    uploadedPhotoPaths.push(path);

    await persistStepPhotoPath(clientA, ENTRY_A.id, STEPS_A.prime, path);

    const { data: stepRow, error: stepError } = await clientA
      .from("steps")
      .select("storage_path")
      .eq("id", STEPS_A.prime)
      .eq("entry_id", ENTRY_A.id)
      .single();

    expect(stepError).toBeNull();
    expect(stepRow).not.toBeNull();
    if (!stepRow) {
      return;
    }
    expect(stepRow.storage_path).toBe(path);

    const signedUrl = await createSignedPhotoUrl(clientA, path, 3600);
    expect(signedUrl).not.toBeNull();
    if (!signedUrl) {
      return;
    }

    const response = await fetch(signedUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toMatch(/^image\//);

    const stepsResult = await loadEntrySteps(clientA, ENTRY_A.id);
    expect(stepsResult.ok).toBe(true);
    if (!stepsResult.ok) {
      return;
    }

    const primeStep = stepsResult.steps.find((step) => step.id === STEPS_A.prime);
    expect(primeStep?.photo_url).not.toBeNull();
  });

  it("resolves a fetchable signed URL for an owner-uploaded final photo", async () => {
    const path = buildFinalPhotoPath(USER_A.id, ENTRY_A.id);
    const file = createMinimalPngFile("final.png");

    const uploadResult = await uploadEntryPhoto(clientA, path, file);
    expect(uploadResult.ok).toBe(true);
    uploadedPhotoPaths.push(path);

    await persistFinalPhotoPath(clientA, ENTRY_A.id, path);

    const { data: entryRow, error: entryError } = await clientA
      .from("entries")
      .select("final_photo_path")
      .eq("id", ENTRY_A.id)
      .single();

    expect(entryError).toBeNull();
    expect(entryRow).not.toBeNull();
    if (!entryRow) {
      return;
    }
    expect(entryRow.final_photo_path).toBe(path);

    const signedUrl = await resolveEntryFinalPhotoUrl(clientA, path);
    expect(signedUrl).not.toBeNull();
    if (!signedUrl) {
      return;
    }

    const response = await fetch(signedUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toMatch(/^image\//);
  });

  it("denies non-owner signed URL and download for another user's photo path", async () => {
    const path = buildStepPhotoPath(USER_A.id, ENTRY_A.id, STEPS_A.layer);
    const file = createMinimalPngFile("foreign.png");

    const uploadResult = await uploadEntryPhoto(clientA, path, file);
    expect(uploadResult.ok).toBe(true);
    uploadedPhotoPaths.push(path);

    const signedUrl = await createSignedPhotoUrl(clientB, path, 3600);
    expect(signedUrl).toBeNull();

    const { error: downloadError } = await clientB.storage.from(ENTRY_PHOTOS_BUCKET).download(path);
    expect(downloadError).not.toBeNull();
  });

  afterAll(async () => {
    await clearStepPhoto(clientA, ENTRY_A.id, STEPS_A.prime);
    await clearFinalPhoto(clientA, ENTRY_A.id);
  });
});

describe("detail loader completeness (Risk #5)", () => {
  it("loads entry basics matching seed oracle", async () => {
    const entry = await loadEntryForEdit(clientA, ENTRY_A.id);

    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({
      title: "Imperial Fist Intercessor",
      model_info: "Space Marine Intercessor",
      model_origin_note: "Indomitus box set",
      status: "ready",
    });
  });

  it("loads paint palette matching seed oracle", async () => {
    const paintsResult = await loadEntryPaints(clientA, ENTRY_A.id);

    expect(paintsResult.ok).toBe(true);
    if (!paintsResult.ok) {
      return;
    }

    expect(paintsResult.paints).toHaveLength(2);
    expect(paintsResult.paints.map((paint) => paint.name)).toEqual(["Imperial Fist", "Wraithbone"]);
    expect(paintsResult.paints.map((paint) => paint.id)).toEqual(
      expect.arrayContaining([PAINTS_A.imperialFist, PAINTS_A.wraithbone]),
    );
  });

  it("loads ordered steps with recipe assignments matching seed oracle", async () => {
    const stepsResult = await loadEntrySteps(clientA, ENTRY_A.id);

    expect(stepsResult.ok).toBe(true);
    if (!stepsResult.ok) {
      return;
    }

    expect(stepsResult.steps.map((step) => step.position)).toEqual([1, 2]);

    const primeStep = stepsResult.steps.find((step) => step.id === STEPS_A.prime);
    const layerStep = stepsResult.steps.find((step) => step.id === STEPS_A.layer);

    expect(primeStep?.description).toBe("Spray prime with Wraithbone");
    expect(primeStep?.assigned_paints.map((paint) => paint.id)).toContain(PAINTS_A.wraithbone);

    expect(layerStep?.description).toBe("Layer Imperial Fist over armor plates");
    expect(layerStep?.assigned_paints).toHaveLength(0);
  });

  it("includes step and final photo URLs when storage paths are set", async () => {
    const stepPath = buildStepPhotoPath(USER_A.id, ENTRY_A.id, STEPS_A.prime);
    const finalPath = buildFinalPhotoPath(USER_A.id, ENTRY_A.id);

    const stepUpload = await uploadEntryPhoto(clientA, stepPath, createMinimalPngFile());
    const finalUpload = await uploadEntryPhoto(clientA, finalPath, createMinimalPngFile("detail-final.png"));
    expect(stepUpload.ok).toBe(true);
    expect(finalUpload.ok).toBe(true);
    uploadedPhotoPaths.push(stepPath, finalPath);

    await persistStepPhotoPath(clientA, ENTRY_A.id, STEPS_A.prime, stepPath);
    await persistFinalPhotoPath(clientA, ENTRY_A.id, finalPath);

    const entry = await loadEntryForEdit(clientA, ENTRY_A.id);
    expect(entry?.final_photo_path).toBe(finalPath);

    const finalPhotoUrl = await resolveEntryFinalPhotoUrl(clientA, entry?.final_photo_path ?? null);
    expect(finalPhotoUrl).not.toBeNull();

    const stepsResult = await loadEntrySteps(clientA, ENTRY_A.id);
    expect(stepsResult.ok).toBe(true);
    if (!stepsResult.ok) {
      return;
    }

    const primeStep = stepsResult.steps.find((step) => step.id === STEPS_A.prime);
    expect(primeStep?.photo_url).not.toBeNull();
  });
});

describe("mutation survivors (Stryker hardening)", () => {
  const malformedEntryId = "not-a-valid-entry-id";

  it("returns null from loadEntryForEdit when the entry does not exist", async () => {
    const entry = await loadEntryForEdit(clientA, randomUUID());
    expect(entry).toBeNull();
  });

  it("returns null from loadEntryForEdit when the entry id is malformed", async () => {
    const entry = await loadEntryForEdit(clientA, malformedEntryId);
    expect(entry).toBeNull();
  });

  it("returns an error from loadEntryPaints when the entry id is malformed", async () => {
    const paintsResult = await loadEntryPaints(clientA, malformedEntryId);
    expect(paintsResult.ok).toBe(false);
    if (paintsResult.ok) {
      return;
    }
    expect(paintsResult.error.length).toBeGreaterThan(0);
  });

  it("returns an error from updateStepWithAssignments when palette load fails", async () => {
    const result = await updateStepWithAssignments(clientA, malformedEntryId, STEPS_A.layer, "Should not persist", [
      PAINTS_A.wraithbone,
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns an error from syncStepPaintAssignments when palette load fails", async () => {
    const result = await syncStepPaintAssignments(clientA, malformedEntryId, STEPS_A.layer, [PAINTS_A.wraithbone]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("stores uploaded photos in the entry-photos bucket", async () => {
    const path = buildStepPhotoPath(USER_A.id, ENTRY_A.id, STEPS_A.layer);
    const file = createMinimalPngFile("bucket-check.png");

    const uploadResult = await uploadEntryPhoto(clientA, path, file);
    expect(uploadResult.ok).toBe(true);
    uploadedPhotoPaths.push(path);

    const { data, error } = await clientA.storage.from(ENTRY_PHOTOS_BUCKET).download(path);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("returns an empty map from createSignedPhotoUrlMap for no paths", async () => {
    const urlMap = await createSignedPhotoUrlMap(clientA, [], 3600);
    expect(urlMap.size).toBe(0);
  });

  it("resolves only accessible paths in a mixed signed URL batch", async () => {
    const ownedPath = buildStepPhotoPath(USER_A.id, ENTRY_A.id, STEPS_A.prime);
    const missingPath = buildStepPhotoPath(USER_A.id, ENTRY_A.id, randomUUID());
    const file = createMinimalPngFile("batch-owned.png");

    const uploadResult = await uploadEntryPhoto(clientA, ownedPath, file);
    expect(uploadResult.ok).toBe(true);
    uploadedPhotoPaths.push(ownedPath);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    const urlMap = await createSignedPhotoUrlMap(clientA, [ownedPath, missingPath], 3600);

    expect(urlMap.get(ownedPath)).toMatch(/^https?:\/\//);
    expect(urlMap.has(missingPath)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("sorts multiple assigned paints by name on a step", async () => {
    const result = await updateStepWithAssignments(clientA, ENTRY_A.id, STEPS_A.layer, "Layer both paints", [
      PAINTS_A.imperialFist,
      PAINTS_A.wraithbone,
    ]);

    expect(result.ok).toBe(true);

    const stepsResult = await loadEntrySteps(clientA, ENTRY_A.id);
    expect(stepsResult.ok).toBe(true);
    if (!stepsResult.ok) {
      return;
    }

    const layerStep = stepsResult.steps.find((step) => step.id === STEPS_A.layer);
    expect(layerStep?.assigned_paints.map((paint) => paint.name)).toEqual(["Imperial Fist", "Wraithbone"]);

    await clientA.from("step_paint_assignments").delete().eq("step_id", STEPS_A.layer);
    await clientA
      .from("steps")
      .update({ description: "Layer Imperial Fist over armor plates" })
      .eq("id", STEPS_A.layer)
      .eq("entry_id", ENTRY_A.id);
  });
});

describe("entry delete cascade", () => {
  let ephemeralEntryId: string;
  let ephemeralPaintId: string;
  let ephemeralStepId: string;

  beforeAll(async () => {
    const { data: entry, error: entryError } = await clientA
      .from("entries")
      .insert({
        user_id: USER_A.id,
        title: "Ephemeral entry to delete",
        description: "Delete cascade test",
        model_info: "Test model",
        model_origin_note: "Test origin",
        status: "draft",
      })
      .select("id")
      .single();

    if (entryError) {
      throw new Error(`Failed to create ephemeral delete entry: ${entryError.message}`);
    }

    ephemeralEntryId = entry.id;

    const { data: paint, error: paintError } = await clientA
      .from("entry_paints")
      .insert({
        entry_id: ephemeralEntryId,
        name: "Delete test paint",
        brand: "Test",
        color_description: "Cascade cleanup",
        approximate_color: "#445566",
      })
      .select("id")
      .single();

    if (paintError) {
      throw new Error(`Failed to create ephemeral delete paint: ${paintError.message}`);
    }

    ephemeralPaintId = paint.id;

    const { data: step, error: stepError } = await clientA
      .from("steps")
      .insert({
        entry_id: ephemeralEntryId,
        position: 1,
        description: "Delete test step",
      })
      .select("id")
      .single();

    if (stepError) {
      throw new Error(`Failed to create ephemeral delete step: ${stepError.message}`);
    }

    ephemeralStepId = step.id;

    const { error: assignmentError } = await clientA.from("step_paint_assignments").insert({
      step_id: ephemeralStepId,
      entry_paint_id: ephemeralPaintId,
    });

    if (assignmentError) {
      throw new Error(`Failed to create ephemeral step paint assignment: ${assignmentError.message}`);
    }
  });

  it("deleteEntryWithPhotos removes entry and cascades child rows", async () => {
    const result = await deleteEntryWithPhotos(clientA, USER_A.id, ephemeralEntryId);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.title).toBe("Ephemeral entry to delete");

    const { data: entry, error: entryError } = await clientA
      .from("entries")
      .select("id")
      .eq("id", ephemeralEntryId)
      .maybeSingle();
    expect(entryError).toBeNull();
    expect(entry).toBeNull();

    const { data: paints, error: paintsError } = await clientA
      .from("entry_paints")
      .select("id")
      .eq("entry_id", ephemeralEntryId);
    expect(paintsError).toBeNull();
    expect(paints).toHaveLength(0);

    const { data: steps, error: stepsError } = await clientA
      .from("steps")
      .select("id")
      .eq("entry_id", ephemeralEntryId);
    expect(stepsError).toBeNull();
    expect(steps).toHaveLength(0);

    const { data: assignments, error: assignmentsError } = await assignmentsForStep(clientA, ephemeralStepId);
    expect(assignmentsError).toBeNull();
    expect(assignments ?? []).toHaveLength(0);

    ephemeralEntryId = "";
  });

  afterAll(async () => {
    if (ephemeralEntryId) {
      const { error: deleteEntryError } = await clientA.from("entries").delete().eq("id", ephemeralEntryId);

      if (deleteEntryError) {
        throw new Error(`Failed to delete ephemeral delete entry: ${deleteEntryError.message}`);
      }
    }
  });
});
