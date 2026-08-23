-- Sprint 07 M0-SD: SECURITY DEFINER disposition hardening candidate migration.
--
-- Refactors the 7 public SECURITY DEFINER routines requiring hardening while
-- preserving their exact signatures, postgres ownership, hardened search paths,
-- and role execution permissions:
-- 1. accept_invite: replaces sensitive email interpolation with non-enumerating message.
-- 2. mark_notification_read: requires explicit authenticated actor (auth.uid() is not null).
-- 3. mark_all_notifications_read: requires explicit authenticated actor (auth.uid() is not null).
-- 4. soft_delete_entity: closed allowlist, fail-closed on unsupported types, ROW_COUNT check, no audit on no-op.
-- 5. restore_entity: closed allowlist, fail-closed on unsupported types, ROW_COUNT check, no audit on no-op.
-- 6. reopen_client_deliverable: removes redundant pre-load authorization check.
-- 7. recover_project_status: enforces approved recovery target allowlist (planning, in_progress, paused).
--
-- This candidate migration is authored for review; it changes no tables, enums,
-- RLS policies, providers, schedulers, or the 11 retained trusted commands.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. accept_invite: non-enumerating error message (R1)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invite(p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_invite record;
  v_user_email extensions.citext;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required to accept invite';
  end if;

  select email into v_user_email
  from auth.users
  where id = v_user_id;

  select *
  into v_invite
  from public.invite_tokens
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid or not found invitation token';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invitation is no longer pending (status: %)', v_invite.status;
  end if;

  if v_invite.expires_at <= now() then
    update public.invite_tokens set status = 'expired' where id = v_invite.id;
    raise exception 'Invitation token has expired';
  end if;

  if v_invite.revoked_at is not null then
    update public.invite_tokens set status = 'revoked' where id = v_invite.id;
    raise exception 'Invitation token has been revoked';
  end if;

  if lower(v_invite.email::text) <> lower(v_user_email::text) then
    raise exception 'Invitation does not belong to the authenticated user';
  end if;

  update public.invite_tokens
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_invite.id;

  insert into public.profiles (
    id,
    role,
    full_name,
    is_active
  ) values (
    v_user_id,
    v_invite.role,
    coalesce(
      (select raw_user_meta_data->>'full_name' from auth.users where id = v_user_id),
      split_part(v_user_email::text, '@', 1)
    ),
    true
  )
  on conflict (id) do update
  set role = v_invite.role,
      is_active = true,
      deleted_at = null,
      updated_at = now();

  if v_invite.project_id is not null then
    declare
      v_member_type public.project_member_type;
    begin
      if v_invite.role = 'operator' then
        v_member_type := 'operator';
      elsif v_invite.role = 'client' then
        v_member_type := 'client';
      else
        v_member_type := 'pm_lead';
      end if;

      insert into public.project_members (
        project_id,
        user_id,
        member_type,
        created_by
      ) values (
        v_invite.project_id,
        v_user_id,
        v_member_type,
        v_invite.created_by
      )
      on conflict do nothing;
    end;
  end if;

  if v_invite.client_id is not null and v_invite.role = 'client' then
    update public.client_contacts
    set profile_id = v_user_id,
        updated_at = now()
    where client_id = v_invite.client_id
      and email = v_invite.email
      and profile_id is null;
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'invite_token',
    v_invite.id,
    v_invite.project_id,
    'invite_accepted',
    jsonb_build_object(
      'email', v_invite.email,
      'role', v_invite.role,
      'project_id', v_invite.project_id,
      'client_id', v_invite.client_id
    ),
    v_user_id,
    v_invite.role
  );

  return jsonb_build_object(
    'success', true,
    'role', v_invite.role,
    'project_id', v_invite.project_id,
    'client_id', v_invite.client_id
  );
end;
$function$;

revoke all on function public.accept_invite(bytea) from public;
revoke all on function public.accept_invite(bytea) from anon;
grant execute on function public.accept_invite(bytea) to authenticated;
grant execute on function public.accept_invite(bytea) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. mark_notification_read: explicit authentication required (R2)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_notification_read(p_notification_recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notification_recipients
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where id = p_notification_recipient_id
    and user_id = v_user_id
    and channel = 'in_app'
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_notification_read(uuid) from anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. mark_all_notifications_read: explicit authentication required (R2)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notification_recipients
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where user_id = v_user_id
    and channel = 'in_app'
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.mark_all_notifications_read() from anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_all_notifications_read() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. soft_delete_entity: closed allowlist, fail-closed, row count check (R3)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.soft_delete_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can soft delete entities';
  end if;

  if p_entity_type in ('audit_log', 'notification', 'deliverable_version', 'feedback', 'invite_token', 'link_report') then
    raise exception 'Entity type % is immutable/constrained and cannot be soft deleted', p_entity_type;
  end if;

  case p_entity_type
    when 'profile' then v_table_name := 'profiles';
    when 'client' then v_table_name := 'clients';
    when 'project' then v_table_name := 'projects';
    when 'project_member' then v_table_name := 'project_members';
    when 'task' then v_table_name := 'tasks';
    when 'deliverable' then v_table_name := 'deliverables';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else
      raise exception 'Entity type % is not supported for soft delete', p_entity_type;
  end case;

  execute format(
    'update public.%I set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null',
    v_table_name
  ) using p_entity_id;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return false;
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    p_entity_type,
    p_entity_id,
    'entity_soft_deleted',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    'admin'
  );

  return true;
end;
$function$;

revoke all on function public.soft_delete_entity(public.entity_type, uuid, text) from public;
revoke all on function public.soft_delete_entity(public.entity_type, uuid, text) from anon;
grant execute on function public.soft_delete_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.soft_delete_entity(public.entity_type, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. restore_entity: closed allowlist, fail-closed, row count check (R3)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.restore_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can restore soft deleted entities';
  end if;

  if p_entity_type in ('audit_log', 'notification', 'deliverable_version', 'feedback', 'invite_token', 'link_report') then
    raise exception 'Entity type % is immutable/constrained and cannot be restored', p_entity_type;
  end if;

  case p_entity_type
    when 'profile' then v_table_name := 'profiles';
    when 'client' then v_table_name := 'clients';
    when 'project' then v_table_name := 'projects';
    when 'project_member' then v_table_name := 'project_members';
    when 'task' then v_table_name := 'tasks';
    when 'deliverable' then v_table_name := 'deliverables';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else
      raise exception 'Entity type % is not supported for restore', p_entity_type;
  end case;

  execute format(
    'update public.%I set deleted_at = null, updated_at = now() where id = $1 and deleted_at is not null',
    v_table_name
  ) using p_entity_id;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return false;
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    p_entity_type,
    p_entity_id,
    'entity_restored',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    'admin'
  );

  return true;
end;
$function$;

revoke all on function public.restore_entity(public.entity_type, uuid, text) from public;
revoke all on function public.restore_entity(public.entity_type, uuid, text) from anon;
grant execute on function public.restore_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.restore_entity(public.entity_type, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reopen_client_deliverable: remove dead pre-load check (R4)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reopen_client_deliverable(p_deliverable_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
    raise exception 'Only an active PM Lead or Admin can reopen a client submission';
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.status <> 'submitted' then
    raise exception 'Deliverable % is not currently submitted (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'A non-empty reason is required to reopen a client submission';
  end if;

  update public.deliverables
  set status = 'pending',
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'client_submission_reopened',
    'submitted',
    'pending',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification to direct Client assignee
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'client_submission_reopened',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object('deliverable_title', v_deliv.title, 'reason', p_reason),
    'client_submission_reopened:' || p_deliverable_id || ':' || extract(epoch from now())::bigint
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status
    ) values (
      v_event_id,
      v_deliv.assignee_id,
      'in_app',
      'pending'
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'status', 'pending',
    'reason', p_reason
  );
end;
$function$;

revoke all on function public.reopen_client_deliverable(uuid, text) from public;
revoke all on function public.reopen_client_deliverable(uuid, text) from anon;
grant execute on function public.reopen_client_deliverable(uuid, text) to authenticated;
grant execute on function public.reopen_client_deliverable(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. recover_project_status: approved recovery target policy (R5)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.recover_project_status(
  p_project_id uuid,
  p_target_status public.project_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_proj record;
  v_user_id uuid := auth.uid();
  v_old_status public.project_status;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can recover project status';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'Recovery reason is mandatory';
  end if;

  if p_target_status not in ('planning', 'in_progress', 'paused') then
    raise exception 'Target status % is not an allowed recovery status. Allowed: planning, in_progress, paused', p_target_status;
  end if;

  select * into v_proj
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Project % not found or deleted', p_project_id;
  end if;

  v_old_status := v_proj.status;

  update public.projects
  set status = p_target_status,
      completed_at = null,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_project_id;

  -- Admin recovery audit event
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'project',
    p_project_id,
    p_project_id,
    'admin_project_recovered',
    v_old_status::text,
    p_target_status::text,
    jsonb_build_object('recovery', true, 'reason', p_reason),
    v_user_id,
    'admin'
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'old_status', v_old_status,
    'target_status', p_target_status,
    'recovered', true
  );
end;
$function$;

revoke all on function public.recover_project_status(uuid, public.project_status, text) from public;
revoke all on function public.recover_project_status(uuid, public.project_status, text) from anon;
grant execute on function public.recover_project_status(uuid, public.project_status, text) to authenticated;
grant execute on function public.recover_project_status(uuid, public.project_status, text) to service_role;

commit;
