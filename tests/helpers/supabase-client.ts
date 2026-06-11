import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const SETUP_MESSAGE = "Local Supabase is not reachable. Run: npx supabase start && npx supabase db reset";
const ANON_KEY_MESSAGE =
  "SUPABASE_KEY must be the local anon key (JWT role: anon). service_role bypasses RLS and invalidates isolation tests.";
const LOCAL_URL_MESSAGE =
  "SUPABASE_URL must point at local Supabase (localhost or 127.0.0.1). Integration tests are local-only.";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);

function assertLocalSupabaseUrl(url: string): void {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(LOCAL_URL_MESSAGE);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(LOCAL_URL_MESSAGE);
  }
}

function getJwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(SETUP_MESSAGE);
  }

  return { url, key };
}

export function createTestClient(): SupabaseClient<Database> {
  const { url, key } = getSupabaseEnv();

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function signInAs(client: SupabaseClient<Database>, email: string, password: string): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  }
}

export async function requireLocalSupabase(): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const role = getJwtRole(key);

  if (role !== "anon") {
    throw new Error(ANON_KEY_MESSAGE);
  }

  assertLocalSupabaseUrl(url);

  const client = createTestClient();

  const healthResponse = await fetch(`${url}/auth/v1/health`);
  if (!healthResponse.ok) {
    throw new Error(SETUP_MESSAGE);
  }

  const { error } = await client.auth.getSession();
  if (error) {
    throw new Error(SETUP_MESSAGE);
  }
}
