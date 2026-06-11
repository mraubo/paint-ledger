import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { APP_BASE_URL, httpGet, httpPostForm, requireDevServer, signInViaHttp } from "../helpers/http-client";
import { ENTRY_A, USER_A } from "../helpers/seed-fixtures";
import { requireLocalSupabase } from "../helpers/supabase-client";

const ENTRY_A_TITLE = "Imperial Fist Intercessor";

const ENTRY_BASICS_FORM = {
  title: ENTRY_A_TITLE,
  description: "Should not apply when unauthenticated",
  model_info: "Test",
  model_origin_note: "Test",
} as const;

function locationPath(response: Response): string {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error(`Expected redirect Location header, got status ${response.status}`);
  }

  return new URL(location, APP_BASE_URL).pathname;
}

function expectRedirectToSignIn(response: Response): void {
  expect([302, 303], `expected redirect, got ${response.status}`).toContain(response.status);
  expect(locationPath(response)).toBe("/auth/signin");
}

beforeAll(async () => {
  await requireLocalSupabase();
  await requireDevServer();
});

describe("route protection (Risk #3)", () => {
  it("unauthenticated GET /entries redirects to sign-in", async () => {
    const response = await httpGet("/entries");
    expectRedirectToSignIn(response);
  });

  it("unauthenticated GET /entries/{id} redirects to sign-in", async () => {
    const response = await httpGet(`/entries/${ENTRY_A.id}`);
    expectRedirectToSignIn(response);
  });

  it("unauthenticated POST /api/entries/{id} redirects to sign-in", async () => {
    const response = await httpPostForm(`/api/entries/${ENTRY_A.id}`, ENTRY_BASICS_FORM);
    expectRedirectToSignIn(response);
  });

  describe("authenticated as user A", () => {
    let userACookie: string;

    beforeEach(async () => {
      userACookie = await signInViaHttp(USER_A.email, USER_A.password);
    });

    it("GET /entries returns 200", async () => {
      const response = await httpGet("/entries", userACookie);
      expect(response.status).toBe(200);
    });

    it("GET /entries/{id} returns 200 with seed entry title", async () => {
      const response = await httpGet(`/entries/${ENTRY_A.id}`, userACookie);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(ENTRY_A_TITLE);
    });
  });
});
