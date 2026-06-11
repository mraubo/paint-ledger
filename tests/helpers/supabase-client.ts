import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const SETUP_MESSAGE = "Local Supabase is not reachable. Run: npx supabase start && npx supabase db reset";

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
  const { url } = getSupabaseEnv();
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
