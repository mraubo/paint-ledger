import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ENTRY_A, PAINTS_A, STEPS_A, USER_A, USER_B } from "../helpers/seed-fixtures";
import { createTestClient, requireLocalSupabase, signInAs } from "../helpers/supabase-client";

type Client = SupabaseClient<Database>;

let clientA: Client;
let clientB: Client;

async function readEntryAs(client: Client, entryId: string) {
  return client.from("entries").select("id, title, user_id").eq("id", entryId).maybeSingle();
}

async function readStepsForEntry(client: Client, entryId: string) {
  return client.from("steps").select("id, position").eq("entry_id", entryId).order("position");
}

beforeAll(async () => {
  await requireLocalSupabase();
  clientA = createTestClient();
  clientB = createTestClient();
  await signInAs(clientA, USER_A.email, USER_A.password);
  await signInAs(clientB, USER_B.email, USER_B.password);
});

afterAll(async () => {
  await clientA.auth.signOut();
  await clientB.auth.signOut();
});

describe("RLS isolation (two seed users)", () => {
  it("user A can read their seeded entry", async () => {
    const { data, error } = await readEntryAs(clientA, ENTRY_A.id);

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: ENTRY_A.id,
      title: "Imperial Fist Intercessor",
      user_id: USER_A.id,
    });
  });

  it("user B cannot read user A's entry by id", async () => {
    const { data, error } = await readEntryAs(clientB, ENTRY_A.id);

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("user B cannot enumerate user A's entries", async () => {
    const { data, error } = await clientB.from("entries").select("id");

    expect(error).toBeNull();
    expect(data?.map((row) => row.id) ?? []).not.toContain(ENTRY_A.id);
  });

  it("user B cannot update or delete user A's entry", async () => {
    const before = await readEntryAs(clientA, ENTRY_A.id);
    expect(before.data).not.toBeNull();

    const updateResult = await clientB
      .from("entries")
      .update({ title: "Hacked by B" })
      .eq("id", ENTRY_A.id)
      .select("id");

    const deleteResult = await clientB.from("entries").delete().eq("id", ENTRY_A.id);

    const leakedUpdate = updateResult.data?.length ?? 0;
    const mutationBlocked = Boolean(updateResult.error) || Boolean(deleteResult.error) || leakedUpdate === 0;

    expect(mutationBlocked).toBe(true);

    const after = await readEntryAs(clientA, ENTRY_A.id);
    expect(after.data).toMatchObject({
      id: ENTRY_A.id,
      title: before.data?.title,
      user_id: USER_A.id,
    });
  });

  it("user B cannot insert paints into user A's entry", async () => {
    const before = await clientA.from("entry_paints").select("id").eq("entry_id", ENTRY_A.id);
    expect(before.error).toBeNull();

    const insertResult = await clientB
      .from("entry_paints")
      .insert({
        entry_id: ENTRY_A.id,
        name: "Forbidden Paint",
        brand: "Test",
        color_description: "Should not land",
        approximate_color: "#000000",
      })
      .select("id");

    const blocked = Boolean(insertResult.error) || (insertResult.data?.length ?? 0) === 0;
    expect(blocked).toBe(true);

    const after = await clientA.from("entry_paints").select("id").eq("entry_id", ENTRY_A.id);
    expect(after.data?.length).toBe(before.data?.length);
  });

  it("user B cannot mutate user A's paints, steps, or assignments", async () => {
    const paintBefore = await clientA.from("entry_paints").select("name").eq("id", PAINTS_A.wraithbone).single();
    const stepBefore = await clientA.from("steps").select("description").eq("id", STEPS_A.prime).single();

    const paintUpdate = await clientB
      .from("entry_paints")
      .update({ name: "Hacked paint" })
      .eq("id", PAINTS_A.wraithbone)
      .select("id");

    const stepUpdate = await clientB
      .from("steps")
      .update({ description: "Hacked step" })
      .eq("id", STEPS_A.prime)
      .select("id");

    const assignmentDelete = await clientB
      .from("step_paint_assignments")
      .delete()
      .eq("step_id", STEPS_A.prime)
      .eq("entry_paint_id", PAINTS_A.wraithbone);

    const childMutationsBlocked =
      Boolean(paintUpdate.error) ||
      Boolean(stepUpdate.error) ||
      Boolean(assignmentDelete.error) ||
      (paintUpdate.data?.length ?? 0) === 0 ||
      (stepUpdate.data?.length ?? 0) === 0;

    expect(childMutationsBlocked).toBe(true);

    const paintAfter = await clientA.from("entry_paints").select("name").eq("id", PAINTS_A.wraithbone).single();
    const stepAfter = await clientA.from("steps").select("description").eq("id", STEPS_A.prime).single();

    expect(paintAfter.data?.name).toBe(paintBefore.data?.name);
    expect(stepAfter.data?.description).toBe(stepBefore.data?.description);
  });

  it("user A cannot create an entry owned by user B", async () => {
    const { data, error } = await clientA
      .from("entries")
      .insert({
        title: "Cross-owner insert",
        description: "Should fail WITH CHECK",
        model_info: "Test",
        model_origin_note: "Test",
        status: "draft",
        user_id: USER_B.id,
      })
      .select("id");

    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("user B cannot delete and renumber user A's steps via RPC", async () => {
    const before = await readStepsForEntry(clientA, ENTRY_A.id);
    expect(before.error).toBeNull();
    expect(before.data?.length).toBeGreaterThan(0);

    const rpcResult = await clientB.rpc("delete_step_and_renumber", {
      p_entry_id: ENTRY_A.id,
      p_step_id: STEPS_A.prime,
    });

    const after = await readStepsForEntry(clientA, ENTRY_A.id);

    const rpcBlocked = Boolean(rpcResult.error);
    const stepsUnchanged =
      after.data
        ?.map((step) => step.id)
        .sort()
        .join(",") ===
      before.data
        ?.map((step) => step.id)
        .sort()
        .join(",");

    expect(rpcBlocked || stepsUnchanged).toBe(true);
  });
});
