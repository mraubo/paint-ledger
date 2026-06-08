-- F-01: Paint log schema, owner-only RLS, and junction invariant trigger

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.entry_status as enum ('draft', 'ready');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  model_info text not null default '',
  model_origin_note text not null default '',
  status public.entry_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entries_user_id_idx on public.entries (user_id);

create table public.entry_paints (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  name text not null,
  brand text not null default '',
  color_description text not null default '',
  approximate_color text not null default '#000000',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entry_paints_entry_id_idx on public.entry_paints (entry_id);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  position integer not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, position)
);

create index steps_entry_id_idx on public.steps (entry_id);

create table public.step_paint_assignments (
  step_id uuid not null references public.steps (id) on delete cascade,
  entry_paint_id uuid not null references public.entry_paints (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, entry_paint_id)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
before update on public.entries
for each row
execute function public.set_updated_at();

create trigger entry_paints_set_updated_at
before update on public.entry_paints
for each row
execute function public.set_updated_at();

create trigger steps_set_updated_at
before update on public.steps
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Junction invariant: step and paint must belong to the same entry
-- ---------------------------------------------------------------------------

create or replace function public.enforce_step_paint_same_entry()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.id = new.entry_paint_id
     and ep.entry_id = s.entry_id
    where s.id = new.step_id
  ) then
    raise exception 'step and entry_paint must belong to the same entry';
  end if;

  return new;
end;
$$;

create trigger enforce_step_paint_same_entry
before insert or update on public.step_paint_assignments
for each row
execute function public.enforce_step_paint_same_entry();

-- ---------------------------------------------------------------------------
-- Grants (Data API access for authenticated role)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.entries to authenticated;
grant select, insert, update, delete on public.entry_paints to authenticated;
grant select, insert, update, delete on public.steps to authenticated;
grant select, insert, update, delete on public.step_paint_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.entries enable row level security;
alter table public.entry_paints enable row level security;
alter table public.steps enable row level security;
alter table public.step_paint_assignments enable row level security;

-- entries: direct ownership
create policy entries_select_own
on public.entries
for select
to authenticated
using (user_id = (select auth.uid()));

create policy entries_insert_own
on public.entries
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy entries_update_own
on public.entries
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy entries_delete_own
on public.entries
for delete
to authenticated
using (user_id = (select auth.uid()));

-- entry_paints: ownership via parent entry
create policy entry_paints_select_own
on public.entry_paints
for select
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = entry_paints.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy entry_paints_insert_own
on public.entry_paints
for insert
to authenticated
with check (
  exists (
    select 1
    from public.entries e
    where e.id = entry_paints.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy entry_paints_update_own
on public.entry_paints
for update
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = entry_paints.entry_id
      and e.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.entries e
    where e.id = entry_paints.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy entry_paints_delete_own
on public.entry_paints
for delete
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = entry_paints.entry_id
      and e.user_id = (select auth.uid())
  )
);

-- steps: ownership via parent entry
create policy steps_select_own
on public.steps
for select
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = steps.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy steps_insert_own
on public.steps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.entries e
    where e.id = steps.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy steps_update_own
on public.steps
for update
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = steps.entry_id
      and e.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.entries e
    where e.id = steps.entry_id
      and e.user_id = (select auth.uid())
  )
);

create policy steps_delete_own
on public.steps
for delete
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = steps.entry_id
      and e.user_id = (select auth.uid())
  )
);

-- step_paint_assignments: ownership via step and paint on the same entry
create policy step_paint_assignments_select_own
on public.step_paint_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.entry_id = s.entry_id
     and ep.id = step_paint_assignments.entry_paint_id
    join public.entries e on e.id = s.entry_id
    where s.id = step_paint_assignments.step_id
      and e.user_id = (select auth.uid())
  )
);

create policy step_paint_assignments_insert_own
on public.step_paint_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.entry_id = s.entry_id
     and ep.id = step_paint_assignments.entry_paint_id
    join public.entries e on e.id = s.entry_id
    where s.id = step_paint_assignments.step_id
      and e.user_id = (select auth.uid())
  )
);

create policy step_paint_assignments_update_own
on public.step_paint_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.entry_id = s.entry_id
     and ep.id = step_paint_assignments.entry_paint_id
    join public.entries e on e.id = s.entry_id
    where s.id = step_paint_assignments.step_id
      and e.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.entry_id = s.entry_id
     and ep.id = step_paint_assignments.entry_paint_id
    join public.entries e on e.id = s.entry_id
    where s.id = step_paint_assignments.step_id
      and e.user_id = (select auth.uid())
  )
);

create policy step_paint_assignments_delete_own
on public.step_paint_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.steps s
    join public.entry_paints ep
      on ep.entry_id = s.entry_id
     and ep.id = step_paint_assignments.entry_paint_id
    join public.entries e on e.id = s.entry_id
    where s.id = step_paint_assignments.step_id
      and e.user_id = (select auth.uid())
  )
);
