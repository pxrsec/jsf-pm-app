-- S10-03: recoverable archive lifecycle, operational recycle bin, and narrowly
-- scoped Admin-only permanent deletion.
--
-- This migration is intentionally forward-only. It replaces the legacy generic
-- soft-delete/restore route for the four S10-03 entities only: projects, tasks,
-- deliverables, and first-class milestones. It does not make contacts,
-- organizations, profiles, invitations, notification/audit history, deliverable
-- versions, or feedback permanently deletable.
--
-- The functions below are the sole authenticated lifecycle command boundaries.
-- Application code must not write archive metadata or delete target rows directly.

begin;

-- -----------------------------------------------------------------------------
-- 1. Canonical recoverable-lifecycle metadata
-- -----------------------------------------------------------------------------
-- Projects already carry archived_at. The remaining metadata makes the archive
-- actor, reason, and deterministic cascade provenance explicit. A child archived
-- because its project/task was archived can be restored with that parent; an
-- independently archived child must remain archived when its parent is restored.

alter table public.projects
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add constraint projects_archive_reason_ck
    check (archive_reason is null or char_length(btrim(archive_reason)) between 1 and 1000);

alter table public.tasks
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archived_parent_project_id uuid,
  add constraint tasks_archive_reason_ck
    check (archive_reason is null or char_length(btrim(archive_reason)) between 1 and 1000);

alter table public.deliverables
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archived_parent_project_id uuid,
  add column if not exists archived_parent_task_id uuid,
  add constraint deliverables_archive_reason_ck
    check (archive_reason is null or char_length(btrim(archive_reason)) between 1 and 1000);

alter table public.milestones
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archived_parent_project_id uuid,
  add constraint milestones_archive_reason_ck
    check (archive_reason is null or char_length(btrim(archive_reason)) between 1 and 1000);

create index if not exists projects_operational_recycle_bin_idx
  on public.projects (archived_at desc, id desc)
  where deleted_at is null and archived_at is not null;

create index if not exists tasks_operational_recycle_bin_idx
  on public.tasks (project_id, archived_at desc, id desc)
  where deleted_at is null and archived_at is not null;

create index if not exists deliverables_operational_recycle_bin_idx
  on public.deliverables (project_id, archived_at desc, id desc)
  where deleted_at is null and archived_at is not null;

create index if not exists milestones_operational_recycle_bin_idx
  on public.milestones (project_id, archived_at desc, id desc)
  where deleted_at is null and archived_at is not null;

-- -----------------------------------------------------------------------------
-- 2. Retention boundary for permanent deletion
-- -----------------------------------------------------------------------------
-- This migration deliberately does NOT relax any foreign key, nullable column,
-- immutable-history trigger, or retention model. A target may be physically
-- deleted only when it is archived and dependency-free. In particular, a project
-- with memberships, invitations, notifications, comments, direct contact links,
-- tasks, deliverables, calendar rows, or project milestones is blocked; a
-- deliverable with versions, feedback, or link reports is blocked. No historic
-- record is orphaned, deleted, or rewritten by S10-03.

-- -----------------------------------------------------------------------------
-- 3. Narrow result type and manager authorization helper
-- -----------------------------------------------------------------------------

create or replace function private.assert_s10_operational_manager()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;
  return v_actor_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4. Archive: recoverable, manager-authorized, and dependency-aware
-- -----------------------------------------------------------------------------

create or replace function public.archive_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := private.assert_s10_operational_manager();
  v_role public.app_role := private.current_user_role();
  v_reason text := nullif(btrim(p_reason), '');
  v_project public.projects%rowtype;
  v_task public.tasks%rowtype;
  v_deliverable public.deliverables%rowtype;
  v_milestone public.milestones%rowtype;
begin
  if p_entity_type not in ('project', 'task', 'deliverable', 'milestone')
    or p_entity_id is null then
    raise exception 'Unsupported operational archive target';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'Archive reason must not exceed 1000 trimmed characters';
  end if;

  if p_entity_type = 'project' then
    select * into v_project from public.projects
      where id = p_entity_id and deleted_at is null for update;
    if not found then return query select false, 'not_found'; return; end if;
    if v_project.archived_at is not null then return query select true, 'already_archived'; return; end if;

    update public.projects set archived_at = now(), archived_by = v_actor_id,
      archive_reason = v_reason, updated_by = v_actor_id, updated_at = now()
      where id = v_project.id and archived_at is null;

    update public.tasks set archived_at = now(), archived_by = v_actor_id,
      archive_reason = v_reason, archived_parent_project_id = v_project.id,
      updated_by = v_actor_id, updated_at = now()
      where project_id = v_project.id and deleted_at is null and archived_at is null;

    update public.deliverables set archived_at = now(), archived_by = v_actor_id,
      archive_reason = v_reason, archived_parent_project_id = v_project.id,
      updated_by = v_actor_id, updated_at = now()
      where project_id = v_project.id and deleted_at is null and archived_at is null;

    update public.milestones set archived_at = now(), archived_by = v_actor_id,
      archive_reason = v_reason, archived_parent_project_id = v_project.id,
      updated_by = v_actor_id, updated_at = now()
      where scope = 'project' and project_id = v_project.id
        and deleted_at is null and archived_at is null;

    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('project', v_project.id, v_project.id, 'project_archived',
      jsonb_build_object('reason_present', v_reason is not null, 'cascade', true), v_actor_id, v_role);
    return query select true, 'archived'; return;
  end if;

  if p_entity_type = 'task' then
    select t.* into v_task from public.tasks t join public.projects p on p.id = t.project_id
      where t.id = p_entity_id and t.deleted_at is null and p.deleted_at is null
        and p.archived_at is null for update of t, p;
    if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
    if v_task.archived_at is not null then return query select true, 'already_archived'; return; end if;

    update public.tasks set archived_at = now(), archived_by = v_actor_id, archive_reason = v_reason,
      updated_by = v_actor_id, updated_at = now() where id = v_task.id and archived_at is null;
    update public.deliverables set archived_at = now(), archived_by = v_actor_id, archive_reason = v_reason,
      archived_parent_task_id = v_task.id, updated_by = v_actor_id, updated_at = now()
      where task_id = v_task.id and deleted_at is null and archived_at is null;
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('task', v_task.id, v_task.project_id, 'task_archived',
      jsonb_build_object('reason_present', v_reason is not null, 'cascade_deliverables', true), v_actor_id, v_role);
    return query select true, 'archived'; return;
  end if;

  if p_entity_type = 'deliverable' then
    select d.* into v_deliverable from public.deliverables d
      join public.tasks t on t.id = d.task_id
      join public.projects p on p.id = d.project_id
      where d.id = p_entity_id and d.deleted_at is null and t.deleted_at is null
        and t.archived_at is null and p.deleted_at is null and p.archived_at is null
      for update of d, t, p;
    if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
    if v_deliverable.archived_at is not null then return query select true, 'already_archived'; return; end if;
    update public.deliverables set archived_at = now(), archived_by = v_actor_id,
      archive_reason = v_reason, updated_by = v_actor_id, updated_at = now()
      where id = v_deliverable.id and archived_at is null;
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('deliverable', v_deliverable.id, v_deliverable.project_id, 'deliverable_archived',
      jsonb_build_object('reason_present', v_reason is not null), v_actor_id, v_role);
    return query select true, 'archived'; return;
  end if;

  select m.* into v_milestone from public.milestones m
    left join public.projects p on p.id = m.project_id
    where m.id = p_entity_id and m.deleted_at is null
      and (m.scope = 'company' or (p.deleted_at is null and p.archived_at is null))
    for update of m;
  if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
  if v_milestone.archived_at is not null then return query select true, 'already_archived'; return; end if;
  update public.milestones set archived_at = now(), archived_by = v_actor_id,
    archive_reason = v_reason, updated_by = v_actor_id, updated_at = now()
    where id = v_milestone.id and archived_at is null;
  insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
  values ('milestone', v_milestone.id, v_milestone.project_id, 'milestone_archived',
    jsonb_build_object('scope', v_milestone.scope, 'reason_present', v_reason is not null), v_actor_id, v_role);
  return query select true, 'archived';
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Restore: manager-authorized and parent-state-safe
-- -----------------------------------------------------------------------------

create or replace function public.restore_archived_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid
)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := private.assert_s10_operational_manager();
  v_role public.app_role := private.current_user_role();
  v_project public.projects%rowtype;
  v_task public.tasks%rowtype;
  v_deliverable public.deliverables%rowtype;
  v_milestone public.milestones%rowtype;
begin
  if p_entity_type not in ('project', 'task', 'deliverable', 'milestone')
    or p_entity_id is null then
    raise exception 'Unsupported operational restore target';
  end if;

  if p_entity_type = 'project' then
    select * into v_project from public.projects
      where id = p_entity_id and deleted_at is null for update;
    if not found then return query select false, 'not_found'; return; end if;
    if v_project.archived_at is null then return query select true, 'already_active'; return; end if;
    update public.projects set archived_at = null, archived_by = null, archive_reason = null,
      updated_by = v_actor_id, updated_at = now() where id = v_project.id;
    update public.tasks set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_project_id = null, updated_by = v_actor_id, updated_at = now()
      where project_id = v_project.id and deleted_at is null
        and archived_parent_project_id = v_project.id;
    update public.deliverables set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_project_id = null, updated_by = v_actor_id, updated_at = now()
      where project_id = v_project.id and deleted_at is null
        and archived_parent_project_id = v_project.id and archived_parent_task_id is null;
    update public.milestones set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_project_id = null, updated_by = v_actor_id, updated_at = now()
      where scope = 'project' and project_id = v_project.id and deleted_at is null
        and archived_parent_project_id = v_project.id;
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('project', v_project.id, v_project.id, 'project_restored',
      jsonb_build_object('cascade', true), v_actor_id, v_role);
    return query select true, 'restored'; return;
  end if;

  if p_entity_type = 'task' then
    select t.* into v_task from public.tasks t join public.projects p on p.id = t.project_id
      where t.id = p_entity_id and t.deleted_at is null and p.deleted_at is null
        and p.archived_at is null for update of t, p;
    if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
    if v_task.archived_at is null then return query select true, 'already_active'; return; end if;
    update public.tasks set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_project_id = null, updated_by = v_actor_id, updated_at = now()
      where id = v_task.id;
    update public.deliverables set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_task_id = null, updated_by = v_actor_id, updated_at = now()
      where task_id = v_task.id and deleted_at is null
        and archived_parent_task_id = v_task.id and archived_parent_project_id is null;
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('task', v_task.id, v_task.project_id, 'task_restored',
      jsonb_build_object('cascade_deliverables', true), v_actor_id, v_role);
    return query select true, 'restored'; return;
  end if;

  if p_entity_type = 'deliverable' then
    select d.* into v_deliverable from public.deliverables d join public.tasks t on t.id = d.task_id
      join public.projects p on p.id = d.project_id
      where d.id = p_entity_id and d.deleted_at is null and t.deleted_at is null
        and t.archived_at is null and p.deleted_at is null and p.archived_at is null
      for update of d, t, p;
    if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
    if v_deliverable.archived_at is null then return query select true, 'already_active'; return; end if;
    update public.deliverables set archived_at = null, archived_by = null, archive_reason = null,
      archived_parent_project_id = null, archived_parent_task_id = null,
      updated_by = v_actor_id, updated_at = now() where id = v_deliverable.id;
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values ('deliverable', v_deliverable.id, v_deliverable.project_id, 'deliverable_restored',
      '{}'::jsonb, v_actor_id, v_role);
    return query select true, 'restored'; return;
  end if;

  select m.* into v_milestone from public.milestones m left join public.projects p on p.id = m.project_id
    where m.id = p_entity_id and m.deleted_at is null
      and (m.scope = 'company' or (p.deleted_at is null and p.archived_at is null)) for update of m;
  if not found then return query select false, 'not_found_or_parent_archived'; return; end if;
  if v_milestone.archived_at is null then return query select true, 'already_active'; return; end if;
  update public.milestones set archived_at = null, archived_by = null, archive_reason = null,
    archived_parent_project_id = null, updated_by = v_actor_id, updated_at = now()
    where id = v_milestone.id;
  insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
  values ('milestone', v_milestone.id, v_milestone.project_id, 'milestone_restored',
    jsonb_build_object('scope', v_milestone.scope), v_actor_id, v_role);
  return query select true, 'restored';
end;
$function$;

-- -----------------------------------------------------------------------------
-- 6. Purpose-limited recycle-bin projection and Admin deletion preview
-- -----------------------------------------------------------------------------

create or replace function public.list_operational_recycle_bin(p_project_id uuid default null)
returns table (
  entity_type public.entity_type,
  entity_id uuid,
  project_id uuid,
  title text,
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  parent_is_archived boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform private.assert_s10_operational_manager();
  return query
  select 'project'::public.entity_type, p.id, p.id, p.name, p.archived_at, p.archived_by,
    p.archive_reason, false from public.projects p
    where p.deleted_at is null and p.archived_at is not null
      and (p_project_id is null or p.id = p_project_id)
  union all
  select 'task'::public.entity_type, t.id, t.project_id, t.title, t.archived_at, t.archived_by,
    t.archive_reason, coalesce(p.archived_at is not null, false) from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.deleted_at is null and t.archived_at is not null
      and (p_project_id is null or t.project_id = p_project_id)
  union all
  select 'deliverable'::public.entity_type, d.id, d.project_id, d.title, d.archived_at, d.archived_by,
    d.archive_reason, coalesce(p.archived_at is not null, false) from public.deliverables d
    join public.projects p on p.id = d.project_id
    where d.deleted_at is null and d.archived_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
  union all
  select 'milestone'::public.entity_type, m.id, m.project_id, m.title, m.archived_at, m.archived_by,
    m.archive_reason, coalesce(p.archived_at is not null, false) from public.milestones m
    left join public.projects p on p.id = m.project_id
    where m.deleted_at is null and m.archived_at is not null
      and (p_project_id is null or m.project_id = p_project_id)
  order by archived_at desc, entity_type asc, entity_id asc;
end;
$function$;

create or replace function public.get_operational_deletion_preview(
  p_entity_type public.entity_type,
  p_entity_id uuid
)
returns table (entity_type public.entity_type, entity_id uuid, title text, can_delete boolean, blocker_code text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_is_archived boolean := false;
  v_has_dependencies boolean := false;
  v_title text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Active Admin authority required';
  end if;
  if p_entity_type not in ('project', 'task', 'deliverable', 'milestone') or p_entity_id is null then
    raise exception 'Unsupported permanent deletion target';
  end if;

  if p_entity_type = 'project' then
    select p.name, p.archived_at is not null into v_title, v_is_archived from public.projects p
      where p.id = p_entity_id and p.deleted_at is null;
    v_has_dependencies := exists (select 1 from public.project_members where project_id = p_entity_id)
      or exists (select 1 from public.tasks where project_id = p_entity_id)
      or exists (select 1 from public.deliverables where project_id = p_entity_id)
      or exists (select 1 from public.collaboration_comments where project_id = p_entity_id)
      or exists (select 1 from public.calendar_events where project_id = p_entity_id)
      or exists (select 1 from public.invite_tokens where project_id = p_entity_id)
      or exists (select 1 from public.notification_events where project_id = p_entity_id)
      or exists (select 1 from public.milestones where project_id = p_entity_id)
      or exists (select 1 from public.project_client_contacts where project_id = p_entity_id);
  elsif p_entity_type = 'task' then
    select t.title, t.archived_at is not null into v_title, v_is_archived from public.tasks t
      where t.id = p_entity_id and t.deleted_at is null;
    v_has_dependencies := exists (select 1 from public.task_resources where task_id = p_entity_id)
      or exists (select 1 from public.deliverables where task_id = p_entity_id)
      or exists (select 1 from public.milestone_tasks where task_id = p_entity_id)
      or exists (select 1 from public.calendar_events where task_id = p_entity_id);
  elsif p_entity_type = 'deliverable' then
    select d.title, d.archived_at is not null into v_title, v_is_archived from public.deliverables d
      where d.id = p_entity_id and d.deleted_at is null;
    v_has_dependencies := exists (select 1 from public.deliverable_versions where deliverable_id = p_entity_id)
      or exists (select 1 from public.deliverable_feedback where deliverable_id = p_entity_id)
      or exists (select 1 from public.deliverable_link_reports where deliverable_id = p_entity_id);
  else
    select m.title, m.archived_at is not null into v_title, v_is_archived from public.milestones m
      where m.id = p_entity_id and m.deleted_at is null;
    v_has_dependencies := exists (select 1 from public.milestone_tasks where milestone_id = p_entity_id);
  end if;

  if v_title is null then
    return query select p_entity_type, p_entity_id, null::text, false, 'not_found';
  elsif not v_is_archived then
    return query select p_entity_type, p_entity_id, v_title, false, 'archive_required';
  elsif v_has_dependencies then
    return query select p_entity_type, p_entity_id, v_title, false, 'dependencies_present';
  end if;
  return query select p_entity_type, p_entity_id, v_title, true, null::text;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 7. Admin-only permanent deletion. The target must already be archived and
-- dependency-free. This command never deletes operational descendants, joins,
-- history, or retention records in order to make a deletion succeed.
-- -----------------------------------------------------------------------------

create or replace function public.permanently_delete_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid
)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_project_id uuid;
  v_title text;
  v_blocked boolean := false;
begin
  if v_actor_id is null or not private.is_admin() then
    raise exception 'Active Admin authority required';
  end if;
  if p_entity_type not in ('project', 'task', 'deliverable', 'milestone') or p_entity_id is null then
    raise exception 'Unsupported permanent deletion target';
  end if;

  if p_entity_type = 'project' then
    select id, name into v_project_id, v_title from public.projects
      where id = p_entity_id and deleted_at is null and archived_at is not null for update;
  elsif p_entity_type = 'task' then
    select project_id, title into v_project_id, v_title from public.tasks
      where id = p_entity_id and deleted_at is null and archived_at is not null for update;
  elsif p_entity_type = 'deliverable' then
    select project_id, title into v_project_id, v_title from public.deliverables
      where id = p_entity_id and deleted_at is null and archived_at is not null for update;
  else
    select project_id, title into v_project_id, v_title from public.milestones
      where id = p_entity_id and deleted_at is null and archived_at is not null for update;
  end if;

  if not found then
    insert into public.audit_logs (entity_type, entity_id, action, changed_fields, actor_id, actor_role)
    values (p_entity_type, p_entity_id, 'permanent_delete_blocked',
      jsonb_build_object('code', 'not_found_or_archive_required'), v_actor_id, 'admin');
    return query select false, 'not_found_or_archive_required'; return;
  end if;

  if p_entity_type = 'project' then
    v_blocked := exists (select 1 from public.project_members where project_id = p_entity_id)
      or exists (select 1 from public.tasks where project_id = p_entity_id)
      or exists (select 1 from public.deliverables where project_id = p_entity_id)
      or exists (select 1 from public.collaboration_comments where project_id = p_entity_id)
      or exists (select 1 from public.calendar_events where project_id = p_entity_id)
      or exists (select 1 from public.invite_tokens where project_id = p_entity_id)
      or exists (select 1 from public.notification_events where project_id = p_entity_id)
      or exists (select 1 from public.milestones where project_id = p_entity_id)
      or exists (select 1 from public.project_client_contacts where project_id = p_entity_id);
  elsif p_entity_type = 'task' then
    v_blocked := exists (select 1 from public.task_resources where task_id = p_entity_id)
      or exists (select 1 from public.deliverables where task_id = p_entity_id)
      or exists (select 1 from public.milestone_tasks where task_id = p_entity_id)
      or exists (select 1 from public.calendar_events where task_id = p_entity_id);
  elsif p_entity_type = 'deliverable' then
    v_blocked := exists (select 1 from public.deliverable_versions where deliverable_id = p_entity_id)
      or exists (select 1 from public.deliverable_feedback where deliverable_id = p_entity_id)
      or exists (select 1 from public.deliverable_link_reports where deliverable_id = p_entity_id);
  else
    v_blocked := exists (select 1 from public.milestone_tasks where milestone_id = p_entity_id);
  end if;

  if v_blocked then
    insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
    values (p_entity_type, p_entity_id,
      case when p_entity_type = 'project' then null else v_project_id end,
      'permanent_delete_blocked', jsonb_build_object('code', 'dependencies_present'), v_actor_id, 'admin');
    return query select false, 'dependencies_present'; return;
  end if;

  -- Audit evidence precedes the physical delete. Audit history is immutable and
  -- survives because it has no FK to the deleted target; project_id SET NULL is
  -- an established baseline behavior for an eligible dependency-free project.
  insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
  values (p_entity_type, p_entity_id,
    case when p_entity_type = 'project' then null else v_project_id end,
    'permanently_deleted', jsonb_build_object('title', v_title, 'archived_first', true, 'dependency_free', true), v_actor_id, 'admin');

  if p_entity_type = 'project' then
    delete from public.projects where id = p_entity_id;
  elsif p_entity_type = 'task' then
    delete from public.tasks where id = p_entity_id;
  elsif p_entity_type = 'deliverable' then
    delete from public.deliverables where id = p_entity_id;
  else
    delete from public.milestones where id = p_entity_id;
  end if;

  return query select true, 'permanently_deleted';
end;
$function$;

-- -----------------------------------------------------------------------------
-- 8. Retire alternate authenticated mutation routes for S10-03 entities.
-- The legacy generic functions remain available only for their non-S10-03
-- historical allowlist. Milestone's old soft-delete command is fully retired.
-- -----------------------------------------------------------------------------

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
  v_actor_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not private.is_admin() then
    raise exception 'Only Admin can soft delete entities';
  end if;
  if p_entity_type in ('project', 'task', 'deliverable', 'milestone') then
    raise exception 'Use archive_operational_entity for S10-03 entities';
  end if;
  case p_entity_type
    when 'profile' then v_table_name := 'profiles';
    when 'client' then v_table_name := 'clients';
    when 'project_member' then v_table_name := 'project_members';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else raise exception 'Entity type % is not supported for legacy soft delete', p_entity_type;
  end case;
  execute format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null', v_table_name)
    using p_entity_id;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then return false; end if;
  insert into public.audit_logs (entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values (p_entity_type, p_entity_id, 'entity_soft_deleted', jsonb_build_object('reason', p_reason), v_actor_id, 'admin');
  return true;
end;
$function$;

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
  v_actor_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not private.is_admin() then
    raise exception 'Only Admin can restore soft deleted entities';
  end if;
  if p_entity_type in ('project', 'task', 'deliverable', 'milestone') then
    raise exception 'Use restore_archived_operational_entity for S10-03 entities';
  end if;
  case p_entity_type
    when 'profile' then v_table_name := 'profiles';
    when 'client' then v_table_name := 'clients';
    when 'project_member' then v_table_name := 'project_members';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else raise exception 'Entity type % is not supported for legacy restore', p_entity_type;
  end case;
  execute format('update public.%I set deleted_at = null, updated_at = now() where id = $1 and deleted_at is not null', v_table_name)
    using p_entity_id;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then return false; end if;
  insert into public.audit_logs (entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values (p_entity_type, p_entity_id, 'entity_restored', jsonb_build_object('reason', p_reason), v_actor_id, 'admin');
  return true;
end;
$function$;

revoke all on function public.soft_delete_milestone(uuid) from public, anon, authenticated, service_role;
revoke all on function public.soft_delete_entity(public.entity_type, uuid, text) from public, anon, service_role;
revoke all on function public.restore_entity(public.entity_type, uuid, text) from public, anon, service_role;
grant execute on function public.soft_delete_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.restore_entity(public.entity_type, uuid, text) to authenticated;

alter function private.assert_s10_operational_manager() owner to postgres;
alter function public.archive_operational_entity(public.entity_type, uuid, text) owner to postgres;
alter function public.restore_archived_operational_entity(public.entity_type, uuid) owner to postgres;
alter function public.list_operational_recycle_bin(uuid) owner to postgres;
alter function public.get_operational_deletion_preview(public.entity_type, uuid) owner to postgres;
alter function public.permanently_delete_operational_entity(public.entity_type, uuid) owner to postgres;

revoke all on function private.assert_s10_operational_manager() from public, anon, authenticated, service_role;
revoke all on function public.archive_operational_entity(public.entity_type, uuid, text) from public, anon, service_role;
revoke all on function public.restore_archived_operational_entity(public.entity_type, uuid) from public, anon, service_role;
revoke all on function public.list_operational_recycle_bin(uuid) from public, anon, service_role;
revoke all on function public.get_operational_deletion_preview(public.entity_type, uuid) from public, anon, service_role;
revoke all on function public.permanently_delete_operational_entity(public.entity_type, uuid) from public, anon, service_role;

grant execute on function public.archive_operational_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.restore_archived_operational_entity(public.entity_type, uuid) to authenticated;
grant execute on function public.list_operational_recycle_bin(uuid) to authenticated;
grant execute on function public.get_operational_deletion_preview(public.entity_type, uuid) to authenticated;
grant execute on function public.permanently_delete_operational_entity(public.entity_type, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Base-table active boundary. These policies prevent browser-facing direct
-- reads/updates from treating archived operational records as active. Trusted
-- lifecycle commands above remain the only archive metadata writers.
-- -----------------------------------------------------------------------------

drop policy if exists projects_select_policy on public.projects;
create policy projects_select_policy on public.projects
for select to authenticated
using (
  deleted_at is null and archived_at is null
  and ((select private.is_pm()) or (select private.is_project_member(id)))
);

drop policy if exists projects_update_policy on public.projects;
create policy projects_update_policy on public.projects
for update to authenticated
using (deleted_at is null and archived_at is null and (select private.is_pm()))
with check (deleted_at is null and archived_at is null and (select private.is_pm()));

drop policy if exists tasks_select_policy on public.tasks;
create policy tasks_select_policy on public.tasks
for select to authenticated
using (
  deleted_at is null and archived_at is null
  and exists (
    select 1 from public.projects p
    where p.id = tasks.project_id and p.deleted_at is null and p.archived_at is null
  )
  and ((select private.is_pm()) or assignee_id = (select auth.uid()))
);

drop policy if exists tasks_update_policy on public.tasks;
create policy tasks_update_policy on public.tasks
for update to authenticated
using (
  deleted_at is null and archived_at is null and (select private.is_pm())
  and exists (select 1 from public.projects p where p.id = tasks.project_id and p.deleted_at is null and p.archived_at is null)
)
with check (
  deleted_at is null and archived_at is null and (select private.is_pm())
  and exists (select 1 from public.projects p where p.id = tasks.project_id and p.deleted_at is null and p.archived_at is null)
);

drop policy if exists deliverables_select_policy on public.deliverables;
create policy deliverables_select_policy on public.deliverables
for select to authenticated
using (
  deleted_at is null and archived_at is null
  and exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = deliverables.task_id and t.deleted_at is null and t.archived_at is null
      and p.deleted_at is null and p.archived_at is null
  )
  and (
    (select private.is_pm()) or assignee_id = (select auth.uid())
    or (workflow_type = 'production' and status in ('awaiting_client_review', 'approved', 'delivered', 'changes_requested')
      and (select private.is_project_client(project_id)))
  )
);

drop policy if exists deliverables_update_policy on public.deliverables;
create policy deliverables_update_policy on public.deliverables
for update to authenticated
using (
  deleted_at is null and archived_at is null and (select private.is_pm())
  and exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = deliverables.task_id and t.deleted_at is null and t.archived_at is null
      and p.deleted_at is null and p.archived_at is null
  )
)
with check (
  deleted_at is null and archived_at is null and (select private.is_pm())
  and exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = deliverables.task_id and t.deleted_at is null and t.archived_at is null
      and p.deleted_at is null and p.archived_at is null
  )
);

commit;
