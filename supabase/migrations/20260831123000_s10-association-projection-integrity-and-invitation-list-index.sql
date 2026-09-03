-- S10 repair: association projection integrity, historical cleanup, and invitation list index.
-- Reference: dev-docs/specs/s10/s10-01-production-readiness-foundation-and-task-detail-implementation-spec.md
--
-- Forward-only repair. The administration association projection must contain only
-- active direct contacts. Historical rows for deleted or organization contacts stay
-- removable through the command but are never exposed to the browser. The invitation
-- administration projection is composite-cursor ordered by created_at/id, so it gets
-- a matching partial index without including email or token material.

begin;

-- Keep the Admin/PM-only association command. Creating an association requires an
-- active direct contact. Disassociation intentionally does not require the contact
-- to remain active/direct so historical rows can be removed idempotently.
create or replace function public.set_project_client_contact(
  p_project_id uuid,
  p_contact_id uuid,
  p_associated boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_contact public.client_contacts%rowtype;
begin
  if v_actor_id is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
    and deleted_at is null
  for update;
  if not found or v_project.project_type <> 'client' then
    raise exception 'Client project is not available';
  end if;

  if p_associated then
    select * into v_contact
    from public.client_contacts
    where id = p_contact_id
      and deleted_at is null
    for update;
    if not found then
      raise exception 'Contact is not available';
    end if;
    if v_contact.client_id is not null then
      raise exception 'Only a direct contact can be associated with a client project';
    end if;

    insert into public.project_client_contacts (project_id, contact_id, created_by)
    values (p_project_id, p_contact_id, v_actor_id)
    on conflict (project_id, contact_id) where deleted_at is null do nothing;
  else
    update public.project_client_contacts
    set deleted_at = now(), updated_at = now()
    where project_id = p_project_id
      and contact_id = p_contact_id
      and deleted_at is null;
  end if;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'project', p_project_id, p_project_id, 'project_client_contact_association_changed',
    jsonb_build_object('contact_id', p_contact_id, 'associated', p_associated),
    v_actor_id, private.current_user_role()
  );

  return p_associated;
end;
$function$;

-- Purpose-limited management projection. Joining the contact record ensures the
-- browser receives only IDs that are currently active direct contacts; it cannot
-- enumerate deleted contacts or historical organization associations.
create or replace function public.list_project_client_contact_associations(
  p_project_id uuid
)
returns table (contact_id uuid)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;

  if not exists (
    select 1
    from public.projects project_row
    where project_row.id = p_project_id
      and project_row.project_type = 'client'
      and project_row.deleted_at is null
  ) then
    raise exception 'Client project is not available';
  end if;

  return query
  select association_row.contact_id
  from public.project_client_contacts association_row
  join public.client_contacts contact_row
    on contact_row.id = association_row.contact_id
    and contact_row.deleted_at is null
    and contact_row.client_id is null
  where association_row.project_id = p_project_id
    and association_row.deleted_at is null
  order by association_row.contact_id asc;
end;
$function$;

-- Matches list_ordinary_invitation_administration's cursor predicate and ordering.
-- It deliberately excludes recipient email, token hash, and raw token columns.
create index if not exists invite_tokens_s10_ordinary_administration_cursor_idx
  on public.invite_tokens (created_at desc, id desc)
  where role in ('client', 'operator');

alter function public.set_project_client_contact(uuid, uuid, boolean) owner to postgres;
alter function public.list_project_client_contact_associations(uuid) owner to postgres;

revoke all on function public.set_project_client_contact(uuid, uuid, boolean) from public, anon, service_role;
revoke all on function public.list_project_client_contact_associations(uuid) from public, anon, service_role;

grant execute on function public.set_project_client_contact(uuid, uuid, boolean) to authenticated;
grant execute on function public.list_project_client_contact_associations(uuid) to authenticated;

commit;
