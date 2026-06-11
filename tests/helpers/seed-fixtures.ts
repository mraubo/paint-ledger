/** Fixed credentials and UUIDs from `supabase/seed.sql` (keep in sync after seed edits). */

export const SEED_PASSWORD = "seed-password-123";

export const USER_A = {
  email: "seed@paint-ledger.local",
  password: SEED_PASSWORD,
  id: "11111111-1111-4111-8111-111111111111",
} as const;

export const USER_B = {
  email: "seed-b@paint-ledger.local",
  password: SEED_PASSWORD,
  id: "55555555-5555-4555-8555-555555555555",
} as const;

export const ENTRY_A = {
  id: "22222222-2222-4222-8222-222222222222",
} as const;

export const PAINTS_A = {
  wraithbone: "33333333-3333-4333-8333-333333333331",
  imperialFist: "33333333-3333-4333-8333-333333333332",
} as const;

export const STEPS_A = {
  prime: "44444444-4444-4444-8444-444444444441",
  layer: "44444444-4444-4444-8444-444444444442",
} as const;
