-- Atomic step mutations for S-04 (assignment sync, reorder, create)

-- ---------------------------------------------------------------------------
-- sync_step_paint_assignments
-- ---------------------------------------------------------------------------

create or replace function public.sync_step_paint_assignments(
  p_entry_id uuid,
  p_step_id uuid,
  p_paint_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.steps
    where id = p_step_id
      and entry_id = p_entry_id
  ) then
    raise exception 'step not found';
  end if;

  delete from public.step_paint_assignments
  where step_id = p_step_id;

  if p_paint_ids is null or coalesce(array_length(p_paint_ids, 1), 0) = 0 then
    return;
  end if;

  insert into public.step_paint_assignments (step_id, entry_paint_id)
  select p_step_id, ep.id
  from public.entry_paints ep
  where ep.entry_id = p_entry_id
    and ep.id = any (p_paint_ids);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_step_with_assignments
-- ---------------------------------------------------------------------------

create or replace function public.update_step_with_assignments(
  p_entry_id uuid,
  p_step_id uuid,
  p_description text,
  p_paint_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.steps
  set description = p_description
  where id = p_step_id
    and entry_id = p_entry_id;

  if not found then
    raise exception 'step not found';
  end if;

  perform public.sync_step_paint_assignments(p_entry_id, p_step_id, p_paint_ids);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_step_at_next_position
-- ---------------------------------------------------------------------------

create or replace function public.create_step_at_next_position(
  p_entry_id uuid,
  p_description text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_next_position integer;
  v_step_id uuid;
begin
  perform 1
  from public.entries
  where id = p_entry_id
  for update;

  select coalesce(max(position), 0) + 1
  into v_next_position
  from public.steps
  where entry_id = p_entry_id;

  insert into public.steps (entry_id, position, description)
  values (p_entry_id, v_next_position, p_description)
  returning id into v_step_id;

  return v_step_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_step_and_renumber
-- ---------------------------------------------------------------------------

create or replace function public.delete_step_and_renumber(
  p_entry_id uuid,
  p_step_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_deleted_position integer;
begin
  select position
  into v_deleted_position
  from public.steps
  where id = p_step_id
    and entry_id = p_entry_id
  for update;

  if not found then
    raise exception 'step not found';
  end if;

  delete from public.steps
  where id = p_step_id
    and entry_id = p_entry_id;

  update public.steps
  set position = position - 1
  where entry_id = p_entry_id
    and position > v_deleted_position;
end;
$$;

-- ---------------------------------------------------------------------------
-- swap_step_positions
-- ---------------------------------------------------------------------------

create or replace function public.swap_step_positions(
  p_entry_id uuid,
  p_step_a uuid,
  p_step_b uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_pos_a integer;
  v_pos_b integer;
begin
  select position
  into v_pos_a
  from public.steps
  where id = p_step_a
    and entry_id = p_entry_id
  for update;

  if not found then
    raise exception 'step not found';
  end if;

  select position
  into v_pos_b
  from public.steps
  where id = p_step_b
    and entry_id = p_entry_id
  for update;

  if not found then
    raise exception 'neighbor step not found';
  end if;

  update public.steps
  set position = case
    when id = p_step_a then v_pos_b
    when id = p_step_b then v_pos_a
  end
  where entry_id = p_entry_id
    and id in (p_step_a, p_step_b);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only (RLS applies via SECURITY INVOKER default)
-- ---------------------------------------------------------------------------

revoke all on function public.sync_step_paint_assignments(uuid, uuid, uuid[]) from public;
revoke all on function public.update_step_with_assignments(uuid, uuid, text, uuid[]) from public;
revoke all on function public.create_step_at_next_position(uuid, text) from public;
revoke all on function public.delete_step_and_renumber(uuid, uuid) from public;
revoke all on function public.swap_step_positions(uuid, uuid, uuid) from public;

grant execute on function public.sync_step_paint_assignments(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.update_step_with_assignments(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function public.create_step_at_next_position(uuid, text) to authenticated;
grant execute on function public.delete_step_and_renumber(uuid, uuid) to authenticated;
grant execute on function public.swap_step_positions(uuid, uuid, uuid) to authenticated;
