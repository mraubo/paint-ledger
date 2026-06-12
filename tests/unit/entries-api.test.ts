import { describe, expect, it } from "vitest";
import { isValidEntryId } from "@/lib/entries-api";
import { ENTRY_A } from "../helpers/seed-fixtures";

describe("isValidEntryId", () => {
  it("accepts seed entry UUIDs", () => {
    expect(isValidEntryId(ENTRY_A.id)).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isValidEntryId("not-a-uuid")).toBe(false);
    expect(isValidEntryId("")).toBe(false);
  });

  it("rejects UUIDs with unsupported version nibble", () => {
    expect(isValidEntryId("11111111-1111-6111-8111-111111111111")).toBe(false);
  });

  it("rejects UUIDs with unsupported variant nibble", () => {
    expect(isValidEntryId("11111111-1111-4111-c111-111111111111")).toBe(false);
  });
});
