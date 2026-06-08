-- F-02: Entry photo storage bucket, owner-scoped storage.objects RLS, photo path columns

-- ---------------------------------------------------------------------------
-- Photo path columns (S-05 populates; existing table RLS unchanged)
-- ---------------------------------------------------------------------------

alter table public.steps
add column storage_path text;

alter table public.entries
add column final_photo_path text;

-- ---------------------------------------------------------------------------
-- Private bucket for step and final entry photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-photos',
  'entry-photos',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

-- ---------------------------------------------------------------------------
-- storage.objects RLS: mirror F-01 entry ownership via path segments
-- Path convention:
--   Step:  {user_id}/{entry_id}/steps/{step_id}
--   Final: {user_id}/{entry_id}/final
-- ---------------------------------------------------------------------------

create policy entry_photos_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'entry-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1
    from public.entries e
    where e.id = split_part(name, '/', 2)::uuid
      and e.user_id = (select auth.uid())
  )
  and (
    (
      split_part(name, '/', 3) = 'final'
      and split_part(name, '/', 4) = ''
    )
    or (
      split_part(name, '/', 3) = 'steps'
      and exists (
        select 1
        from public.steps s
        where s.id = split_part(name, '/', 4)::uuid
          and s.entry_id = split_part(name, '/', 2)::uuid
      )
    )
  )
);

create policy entry_photos_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'entry-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1
    from public.entries e
    where e.id = split_part(name, '/', 2)::uuid
      and e.user_id = (select auth.uid())
  )
  and (
    (
      split_part(name, '/', 3) = 'final'
      and split_part(name, '/', 4) = ''
    )
    or (
      split_part(name, '/', 3) = 'steps'
      and exists (
        select 1
        from public.steps s
        where s.id = split_part(name, '/', 4)::uuid
          and s.entry_id = split_part(name, '/', 2)::uuid
      )
    )
  )
);

create policy entry_photos_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'entry-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1
    from public.entries e
    where e.id = split_part(name, '/', 2)::uuid
      and e.user_id = (select auth.uid())
  )
  and (
    (
      split_part(name, '/', 3) = 'final'
      and split_part(name, '/', 4) = ''
    )
    or (
      split_part(name, '/', 3) = 'steps'
      and exists (
        select 1
        from public.steps s
        where s.id = split_part(name, '/', 4)::uuid
          and s.entry_id = split_part(name, '/', 2)::uuid
      )
    )
  )
)
with check (
  bucket_id = 'entry-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1
    from public.entries e
    where e.id = split_part(name, '/', 2)::uuid
      and e.user_id = (select auth.uid())
  )
  and (
    (
      split_part(name, '/', 3) = 'final'
      and split_part(name, '/', 4) = ''
    )
    or (
      split_part(name, '/', 3) = 'steps'
      and exists (
        select 1
        from public.steps s
        where s.id = split_part(name, '/', 4)::uuid
          and s.entry_id = split_part(name, '/', 2)::uuid
      )
    )
  )
);

create policy entry_photos_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'entry-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1
    from public.entries e
    where e.id = split_part(name, '/', 2)::uuid
      and e.user_id = (select auth.uid())
  )
  and (
    (
      split_part(name, '/', 3) = 'final'
      and split_part(name, '/', 4) = ''
    )
    or (
      split_part(name, '/', 3) = 'steps'
      and exists (
        select 1
        from public.steps s
        where s.id = split_part(name, '/', 4)::uuid
          and s.entry_id = split_part(name, '/', 2)::uuid
      )
    )
  )
);
