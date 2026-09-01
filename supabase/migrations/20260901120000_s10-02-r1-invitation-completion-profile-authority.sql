-- S10-02-R1: Trusted ordinary-invitation completion with invitee-authoritative
-- profile/contact details. The invitation email remains immutable, pre-bound,
-- and verified by the invitation/Authentication identity match.
--
-- This is a forward-only repair over the applied S10 invitation chain. It does
-- not activate providers, send email/WhatsApp, create public signup, expose
-- token material, or add browser table access.

begin;

-- The original consent constraint requires an IP address even though the
-- application-to-database connection cannot truthfully establish the end-user
-- network address. Preserve consent timestamp evidence and require an explicit
-- source when opt-in is true. Retain existing historical values unchanged and
-- label previously source-less true rows as legacy rather than inventing a
-- request-origin IP address.
update public.profiles
set whatsapp_consent_source = 'legacy'
where whatsapp_opt_in = true
  and whatsapp_consent_source is null;

alter table public.profiles
  drop constraint if exists profiles_whatsapp_consent_ck;
alter table public.profiles
  add constraint profiles_whatsapp_consent_ck check (
    whatsapp_opt_in = false
    or (
      whatsapp_consent_at is not null
      and whatsapp_consent_source is not null
      and char_length(btrim(whatsapp_consent_source)) between 1 and 120
    )
  );

-- Replace the one-argument acceptance command. A successful caller is the
-- freshly authenticated identity whose auth.users email must equal the
-- immutable invitation email. The command atomically applies the acceptance,
-- profile/contact details, optional project membership, and audit evidence.
drop function if exists public.accept_invite(bytea);

create function public.accept_invite(
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

  -- Read identity fields first but do not lock the invitation yet. Lock order
  -- must match create/rotate: contact, project, then invitation token.
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
  -- Completion is only for a newly created Auth identity.  Never let a
  -- pre-existing Client/Operator identity change application role or create a
  -- second membership capacity for the same project.
  if found then
    raise exception 'Invitation cannot be accepted';
  end if;

  if v_invite.role = 'client' then
    -- Lock contact before project. This matches the lock order used by
    -- invitation creation/rotation and avoids a contact/project deadlock.
    if v_invite.contact_id is not null then
      select * into v_contact
      from public.client_contacts
      where id = v_invite.contact_id
        and deleted_at is null
      for update;
    elsif v_invite.client_id is not null then
      -- Legacy organization-invitation compatibility only.
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

  -- Re-read under lock after contact/project locks. This serializes acceptance
  -- with invitation creation/rotation and makes the terminal-state decision
  -- from the current token row rather than the preliminary read above.
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

  -- Audit only non-sensitive lifecycle evidence. Never store token/email/phone.
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

alter function public.accept_invite(bytea, text, text, boolean) owner to postgres;
revoke all on function public.accept_invite(bytea, text, text, boolean)
  from public, anon, service_role;
grant execute on function public.accept_invite(bytea, text, text, boolean)
  to authenticated;

commit;
