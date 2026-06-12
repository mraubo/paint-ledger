import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { APP_BASE_URL, httpGet, httpPostForm, requireDevServer, signInViaHttp } from "../helpers/http-client";
import { ENTRY_A, USER_A, USER_B } from "../helpers/seed-fixtures";
import { createTestClient, requireLocalSupabase, signInAs } from "../helpers/supabase-client";

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

function responseLocation(response: Response): string {
  const location = response.headers.get("location");
  if (!location) {
    return "";
  }

  return new URL(location, APP_BASE_URL).href;
}

function expectNoSuccessRedirect(response: Response, successPatterns: string[]): void {
  expect([302, 303], `expected redirect denial, got ${response.status}`).toContain(response.status);
  const location = responseLocation(response);
  for (const pattern of successPatterns) {
    expect(location, `unexpected success redirect containing ${pattern}`).not.toContain(pattern);
  }
}

function expectCrossUserRedirectDenial(response: Response): void {
  expect([302, 303], `expected cross-user redirect denial, got ${response.status}`).toContain(response.status);
  const location = responseLocation(response);
  expect(location, "expected error= in redirect Location for cross-user denial").toContain("error=");
  expect(new URL(location, APP_BASE_URL).pathname, "cross-user denial must not be unauthenticated sign-in").not.toBe(
    "/auth/signin",
  );
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

    // Fresh sign-in per test: Vitest runs files in parallel; reused cookies were flaky across workers.
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

describe("IDOR denial (Risk #6)", () => {
  let userBCookie: string;

  // Fresh sign-in per test — see authenticated-as-user-A describe above.
  beforeEach(async () => {
    userBCookie = await signInViaHttp(USER_B.email, USER_B.password);
  });

  it("user B GET /entries/{ENTRY_A.id} does not expose user A entry", async () => {
    const response = await httpGet(`/entries/${ENTRY_A.id}`, userBCookie);
    expectCrossUserRedirectDenial(response);
  });

  it("user B POST /api/entries/{ENTRY_A.id} cannot update user A entry", async () => {
    const response = await httpPostForm(
      `/api/entries/${ENTRY_A.id}`,
      {
        ...ENTRY_BASICS_FORM,
        title: "Hacked by user B",
      },
      userBCookie,
    );

    expectNoSuccessRedirect(response, ["saved=1"]);
    expectCrossUserRedirectDenial(response);

    const client = createTestClient();
    await signInAs(client, USER_A.email, USER_A.password);
    const { data } = await client.from("entries").select("title").eq("id", ENTRY_A.id).maybeSingle();
    expect(data?.title).toBe(ENTRY_A_TITLE);
    await client.auth.signOut();
  });

  it("user B POST /api/entries/{ENTRY_A.id}/paints cannot add paint to user A entry", async () => {
    const client = createTestClient();
    await signInAs(client, USER_A.email, USER_A.password);
    const before = await client.from("entry_paints").select("id").eq("entry_id", ENTRY_A.id);
    expect(before.error).toBeNull();

    const response = await httpPostForm(
      `/api/entries/${ENTRY_A.id}/paints`,
      {
        name: "Forbidden Paint",
        brand: "Test",
        color_description: "Should not land",
        approximate_color: "#111111",
      },
      userBCookie,
    );

    expectNoSuccessRedirect(response, ["added=1"]);
    expectCrossUserRedirectDenial(response);

    const after = await client.from("entry_paints").select("id").eq("entry_id", ENTRY_A.id);
    expect(after.error).toBeNull();
    expect(after.data?.length).toBe(before.data?.length);
    await client.auth.signOut();
  });

  it("user B POST /api/entries/{ENTRY_A.id}/status-change cannot change user A entry status", async () => {
    const client = createTestClient();
    await signInAs(client, USER_A.email, USER_A.password);
    const before = await client.from("entries").select("status").eq("id", ENTRY_A.id).single();
    expect(before.error).toBeNull();

    const response = await httpPostForm(`/api/entries/${ENTRY_A.id}/status-change`, { status: "draft" }, userBCookie);

    expectNoSuccessRedirect(response, ["status_changed="]);
    expectCrossUserRedirectDenial(response);

    const after = await client.from("entries").select("status").eq("id", ENTRY_A.id).single();
    expect(after.error).toBeNull();
    expect(after.data?.status).toBe(before.data?.status);
    await client.auth.signOut();
  });
});
