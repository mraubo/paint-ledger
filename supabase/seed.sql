-- LOCAL DEVELOPMENT ONLY — do not run against production.
-- Seeds a dev auth user plus one paint-log fixture for Studio inspection and RLS smoke tests.
--
-- Sign in locally with:
--   User A — Email: seed@paint-ledger.local    Password: seed-password-123
--   User B — Email: seed-b@paint-ledger.local  Password: seed-password-123  (no fixture rows; RLS cross-user tests)

-- Fixed UUIDs keep fixture rows stable across `supabase db reset`.
-- seed user A
--   11111111-1111-4111-8111-111111111111
-- seed user B
--   55555555-5555-4555-8555-555555555555
-- entry
--   22222222-2222-4222-8222-222222222222
-- paints
--   33333333-3333-4333-8333-333333333331
--   33333333-3333-4333-8333-333333333332
-- steps
--   44444444-4444-4444-8444-444444444441
--   44444444-4444-4444-8444-444444444442

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'seed@paint-ledger.local',
  crypt('seed-password-123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'email', 'seed@paint-ledger.local',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'seed-b@paint-ledger.local',
  crypt('seed-password-123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '55555555-5555-4555-8555-555555555555',
  '55555555-5555-4555-8555-555555555555',
  '55555555-5555-4555-8555-555555555555',
  jsonb_build_object(
    'sub', '55555555-5555-4555-8555-555555555555',
    'email', 'seed-b@paint-ledger.local',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
);

insert into public.entries (
  id,
  user_id,
  title,
  description,
  model_info,
  model_origin_note,
  status
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Imperial Fist Intercessor',
  'Base yellow recipe with Agrax wash and edge highlights.',
  'Space Marine Intercessor',
  'Indomitus box set',
  'ready'
);

insert into public.entry_paints (
  id,
  entry_id,
  name,
  brand,
  color_description,
  approximate_color
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    '22222222-2222-4222-8222-222222222222',
    'Wraithbone',
    'Citadel',
    'Spray primer and base coat',
    '#E5E4D5'
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    '22222222-2222-4222-8222-222222222222',
    'Imperial Fist',
    'Citadel',
    'Armor yellow layer',
    '#F3D342'
  );

insert into public.steps (
  id,
  entry_id,
  position,
  description
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '22222222-2222-4222-8222-222222222222',
    1,
    'Spray prime with Wraithbone'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '22222222-2222-4222-8222-222222222222',
    2,
    'Layer Imperial Fist over armor plates'
  );

insert into public.step_paint_assignments (
  step_id,
  entry_paint_id
)
values (
  '44444444-4444-4444-8444-444444444441',
  '33333333-3333-4333-8333-333333333331'
);
