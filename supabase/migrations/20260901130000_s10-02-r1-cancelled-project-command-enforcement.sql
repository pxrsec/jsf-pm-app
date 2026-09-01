-- S10-02-R1: reject cancelled projects at every direct-client association and
-- ordinary-invitation command boundary.
--
-- The applied S10 readiness model treats cancelled projects as inactive. The
-- prior S10 command hardening excluded deleted and archived projects but still
-- allowed direct association, association projection, invitation creation or
-- rotation, and acceptance membership creation for cancelled projects.
--
-- This forward-only repair keeps planning eligible: planning projects may carry
-- no organization and may receive a direct-contact association/invitation before
-- accepted completion establishes the Client membership needed by later
-- non-planning readiness. It does not alter invitation history, provider scope,
-- base-table browser access, or membership semantics.

begin;

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
    and archived_at is null
    and status <> 'cancelled'
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
      and project_row.archived_at is null
      and project_row.status <> 'cancelled'
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

create or replace function private.resolve_s10_ordinary_invitation(
  p_role public.app_role,
  p_contact_id uuid,
  p_recipient_email text,
  p_project_id uuid
)
returns table (
  recipient_email extensions.citext,
  contact_id uuid,
  client_id uuid,
  project_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_contact public.client_contacts%rowtype;
  v_project public.projects%rowtype;
begin
  perform private.assert_s10_invitation_manager();

  if p_role not in ('client', 'operator') then
    raise exception 'Invitation role is unavailable';
  end if;

  if p_role = 'client' then
    if p_contact_id is null or p_recipient_email is not null then
      raise exception 'Client invitation requires an exact contact';
    end if;

    select * into v_contact
    from public.client_contacts
    where id = p_contact_id
      and deleted_at is null
    for share;

    if not found then
      raise exception 'Invitation contact is unavailable';
    end if;
    if v_contact.profile_id is not null then
      raise exception 'Invitation contact already has an account';
    end if;

    if p_project_id is not null then
      select * into v_project
      from public.projects
      where id = p_project_id
        and deleted_at is null
        and archived_at is null
        and status <> 'cancelled'
      for share;

      if not found or v_project.project_type <> 'client' then
        raise exception 'Invitation project is unavailable';
      end if;

      if v_contact.client_id is null then
        if not exists (
          select 1
          from public.project_client_contacts pcc
          where pcc.project_id = v_project.id
            and pcc.contact_id = v_contact.id
            and pcc.deleted_at is null
        ) then
          raise exception 'Invitation contact is not associated with the selected project';
        end if;
      elsif v_project.client_id is distinct from v_contact.client_id then
        raise exception 'Invitation contact does not match the selected project';
      end if;
    end if;

    return query select v_contact.email, v_contact.id, v_contact.client_id, p_project_id;
    return;
  end if;

  if p_contact_id is not null then
    raise exception 'Operator invitation cannot bind a client contact';
  end if;
  if p_recipient_email is null
    or char_length(btrim(p_recipient_email)) not between 3 and 320
    or position('@' in btrim(p_recipient_email)) = 0 then
    raise exception 'A valid recipient email is required';
  end if;

  if p_project_id is not null then
    select * into v_project
    from public.projects
    where id = p_project_id
      and deleted_at is null
      and archived_at is null
      and status <> 'cancelled'
    for share;

    if not found then
      raise exception 'Invitation project is unavailable';
    end if;
  end if;

  return query select btrim(p_recipient_email)::extensions.citext, null::uuid, null::uuid, p_project_id;
end;
$function$;

create or replace function public.accept_invite(
  p_token_hash bytea,
  p_full_name text,
  p_phone_e164 text,
  p_whatsapp_opt_in boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_invite public.invite_tokens%rowtype;
  v_contact public.client_contacts%rowtype;
  v_project public.projects%rowtype;
  v_user_email extensions.citext;
  v_user_id uuid := auth.uid();
  v_member_type public.project_member_type;
  v_full_name text := btrim(p_full_name);
  v_phone_e164 text := nullif(btrim(p_phone_e164), '');
begin
  if v_user_id is null then
    raise exception 'Invitation cannot be accepted';
  end if;
  if coalesce(char_length(v_full_name), 0) not between 1 and 120 then
    raise exception 'Invitation cannot be accepted';
  end if;
  if p_whatsapp_opt_in is null then
    raise exception 'Invitation cannot be accepted';
  end if;
  if v_phone_e164 is not null
    and v_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invitation cannot be accepted';
  end if;

  select email into v_user_email
  from auth.users
  where id = v_user_id;
  if v_user_email is null then
    raise exception 'Invitation cannot be accepted';
  end if;

  -- Discover identity context before taking the canonical contact/project/token
  -- locks. The final invitation state is re-read under token lock below.
  select * into v_invite
  from public.invite_tokens
  where token_hash = p_token_hash;
  if not found then
    raise exception 'Invitation cannot be accepted';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;
  if found then
    raise exception 'Invitation cannot be accepted';
  end if;

  if v_invite.role = 'client' then
    if v_invite.contact_id is not null then
      select * into v_contact
      from public.client_contacts
      where id = v_invite.contact_id
        and deleted_at is null
      for update;
    elsif v_invite.client_id is not null then
      select * into v_contact
      from public.client_contacts
      where client_id = v_invite.client_id
        and email = v_invite.email
        and deleted_at is null
      for update;
    else
      raise exception 'Invitation cannot be accepted';
    end if;

    if not found
      or lower(v_contact.email::text) <> lower(v_user_email::text)
      or (v_contact.profile_id is not null and v_contact.profile_id <> v_user_id) then
      raise exception 'Invitation cannot be accepted';
    end if;
    if v_invite.client_id is not null
      and v_contact.client_id is distinct from v_invite.client_id then
      raise exception 'Invitation cannot be accepted';
    end if;
  end if;

  if v_invite.project_id is not null then
    select * into v_project
    from public.projects
    where id = v_invite.project_id
      and deleted_at is null
      and archived_at is null
      and status <> 'cancelled'
    for update;
    if not found then
      raise exception 'Invitation cannot be accepted';
    end if;

    if v_invite.role = 'client' then
      if v_contact.client_id is null then
        if not exists (
          select 1
          from public.project_client_contacts pcc
          where pcc.project_id = v_invite.project_id
            and pcc.contact_id = v_contact.id
            and pcc.deleted_at is null
        ) then
          raise exception 'Invitation cannot be accepted';
        end if;
      elsif v_project.client_id is distinct from v_contact.client_id then
        raise exception 'Invitation cannot be accepted';
      end if;
    end if;
  end if;

  select * into v_invite
  from public.invite_tokens
  where id = v_invite.id
    and token_hash = p_token_hash
  for update;
  if not found then
    raise exception 'Invitation cannot be accepted';
  end if;
  if v_invite.status <> 'pending'
    or v_invite.revoked_at is not null
    or v_invite.expires_at <= now() then
    if v_invite.status = 'pending' and v_invite.expires_at <= now() then
      update public.invite_tokens
      set status = 'expired'
      where id = v_invite.id;
    elsif v_invite.status = 'pending' and v_invite.revoked_at is not null then
      update public.invite_tokens
      set status = 'revoked'
      where id = v_invite.id;
    end if;
    raise exception 'Invitation cannot be accepted';
  end if;
  if v_invite.role not in ('operator', 'client')
    or lower(v_invite.email::text) <> lower(v_user_email::text) then
    raise exception 'Invitation cannot be accepted';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    phone_e164,
    whatsapp_opt_in,
    whatsapp_consent_at,
    whatsapp_consent_source,
    is_active
  ) values (
    v_user_id,
    v_invite.role,
    v_full_name,
    v_phone_e164,
    p_whatsapp_opt_in,
    case when p_whatsapp_opt_in then now() else null end,
    case when p_whatsapp_opt_in then 'invitation' else null end,
    true
  );

  if v_invite.role = 'client' then
    update public.client_contacts
    set profile_id = v_user_id,
        full_name = v_full_name,
        phone_e164 = v_phone_e164,
        updated_by = v_user_id,
        updated_at = now()
    where id = v_contact.id
      and (profile_id is null or profile_id = v_user_id);

    if not found then
      raise exception 'Invitation cannot be accepted';
    end if;
  end if;

  if v_invite.project_id is not null then
    v_member_type := case
      when v_invite.role = 'operator' then 'operator'::public.project_member_type
      else 'client'::public.project_member_type
    end;

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
    );
  end if;

  update public.invite_tokens
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_invite.id;

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
      'role', v_invite.role,
      'project_id', v_invite.project_id,
      'client_id', v_invite.client_id,
      'contact_id', v_invite.contact_id,
      'profile_completed', true,
      'whatsapp_opt_in', p_whatsapp_opt_in
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

alter function public.set_project_client_contact(uuid, uuid, boolean) owner to postgres;
alter function public.list_project_client_contact_associations(uuid) owner to postgres;
alter function private.resolve_s10_ordinary_invitation(public.app_role, uuid, text, uuid) owner to postgres;
alter function public.accept_invite(bytea, text, text, boolean) owner to postgres;

revoke all on function public.set_project_client_contact(uuid, uuid, boolean) from public, anon, service_role;
revoke all on function public.list_project_client_contact_associations(uuid) from public, anon, service_role;
revoke all on function private.resolve_s10_ordinary_invitation(public.app_role, uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.accept_invite(bytea, text, text, boolean) from public, anon, service_role;

grant execute on function public.set_project_client_contact(uuid, uuid, boolean) to authenticated;
grant execute on function public.list_project_client_contact_associations(uuid) to authenticated;
grant execute on function public.accept_invite(bytea, text, text, boolean) to authenticated;

commit;
