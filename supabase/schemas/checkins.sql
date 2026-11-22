create table public.checkins (
    id bigint generated always as identity primary key,
    event_id text not null references public.events (id) on delete restrict,
    user_id uuid references public.profiles (id) on delete cascade,
    email text check (email = lower(email) and char_length(email) <= 254),
    checked_in_at timestamptz not null default now(),
    constraint checkins_event_id_email_key unique (event_id, email),
    constraint checkins_event_id_user_id_key unique (event_id, user_id),
    constraint checkins_owner_check check ((user_id is null) <> (email is null))
);

comment on table public.checkins is 'Door attendance, one row per event and person. A row holds user_id once the member has checked in or claimed it while signed in; until then it holds only the address typed at the door, which earns nothing and touches no account.';

create index checkins_email_idx on public.checkins (email) where email is not null;
create index checkins_user_id_idx on public.checkins (user_id);

alter table public.checkins enable row level security;

revoke all on table public.checkins from anon, authenticated, service_role;
grant select on table public.checkins to authenticated;

create policy checkins_select_own_or_admin on public.checkins
for select to authenticated
using (
    user_id = (select auth.uid())
    or email = lower((select auth.jwt()) ->> 'email')
    or (select private.is_admin())
);

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'door_secret', 'Signs the rotating door codes for event check-in.')
where not exists (select 1 from vault.decrypted_secrets s where s.name = 'door_secret');

create function private.door_code(p_event_id text, p_step bigint)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select left(encode(extensions.hmac(convert_to(p_event_id || ':' || p_step::text, 'utf8'), convert_to(s.decrypted_secret, 'utf8'), 'sha256'), 'hex'), 12)
    from vault.decrypted_secrets s
    where s.name = 'door_secret';
$$;

revoke execute on function private.door_code(text, bigint) from public;

create function private.find_door_event(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select e.id
    from public.events e
    cross join generate_series(0, 2) as age (steps)
    where now() between e.starts_at - interval '1 hour' and e.ends_at
        and private.door_code(e.id, floor(extract(epoch from now()))::bigint / 60 - age.steps) = p_code
    order by e.starts_at
    limit 1;
$$;

revoke execute on function private.find_door_event(text) from public;
grant execute on function private.find_door_event(text) to anon, authenticated;

create function private.get_door_code()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_epoch bigint := floor(extract(epoch from now()))::bigint;
    v_event_id text;
begin
    if not (select private.is_admin()) then
        raise exception 'not_admin' using errcode = '42501';
    end if;

    if not private.is_switch_open('check_in') then
        return null;
    end if;

    select e.id into v_event_id
    from public.events e
    where now() between e.starts_at - interval '1 hour' and e.ends_at
    order by e.starts_at
    limit 1;

    if v_event_id is null then
        return null;
    end if;

    return jsonb_build_object(
        'code', private.door_code(v_event_id, v_epoch / 60),
        'event_id', v_event_id,
        'seconds_left', 60 - v_epoch % 60
    );
end;
$$;

revoke execute on function private.get_door_code() from public;
grant execute on function private.get_door_code() to authenticated;

create function private.claim_checkins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_checkin record;
    v_claimed integer := 0;
    v_email text;
    v_user_id uuid := (select auth.uid());
begin
    select lower(u.email) into v_email
    from auth.users u
    where u.id = v_user_id and u.email_confirmed_at is not null;

    if v_email is null then
        return 0;
    end if;

    delete from public.checkins c
    where c.email = v_email
        and exists (select 1 from public.checkins d where d.event_id = c.event_id and d.user_id = v_user_id);

    for v_checkin in
        update public.checkins c
        set email = null, user_id = v_user_id
        from public.events e
        where c.email = v_email and e.id = c.event_id
        returning e.label
    loop
        perform private.add_prods(v_user_id, 1, 'Attended ' || v_checkin.label);

        v_claimed := v_claimed + 1;
    end loop;

    return v_claimed;
end;
$$;

revoke execute on function private.claim_checkins() from public;
grant execute on function private.claim_checkins() to authenticated;

create function private.check_in(p_code text, p_email text, p_newsletter boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_event public.events;
    v_is_confirmed boolean;
    v_repeated boolean;
    v_user_id uuid;
begin
    if char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
        raise exception 'email_invalid';
    end if;

    if not private.is_switch_open('check_in') then
        raise exception 'check_in_closed';
    end if;

    select e.* into v_event from public.events e where e.id = private.find_door_event(p_code);

    if not found then
        raise exception 'door_code_expired';
    end if;

    select u.id, u.email_confirmed_at is not null into v_user_id, v_is_confirmed
    from auth.users u
    where u.email = v_email;

    if v_user_id is null or not v_is_confirmed or v_user_id is distinct from (select auth.uid()) then
        perform pg_advisory_xact_lock(hashtextextended('check_in:' || v_event.id, 0));

        if (
            select count(*)
            from public.checkins c
            where c.event_id = v_event.id and c.user_id is null and c.checked_in_at > now() - interval '1 minute'
        ) >= 30 then
            raise exception 'check_in_full';
        end if;

        insert into public.checkins (event_id, email)
        values (v_event.id, v_email)
        on conflict (event_id, email) do nothing;

        if p_newsletter then
            perform private.add_subscriber(v_email, 'checkin', false);
        end if;

        return jsonb_build_object(
            'confirmed', coalesce(v_is_confirmed, false),
            'event_id', v_event.id,
            'prods', null,
            'repeated', false
        );
    end if;

    perform private.claim_checkins();

    insert into public.checkins (event_id, user_id)
    values (v_event.id, v_user_id)
    on conflict (event_id, user_id) do nothing;

    v_repeated := not found;

    if not v_repeated then
        perform private.add_prods(v_user_id, 1, 'Attended ' || v_event.label);
    end if;

    update public.profiles p set terms_accepted_at = now() where p.id = v_user_id and p.terms_accepted_at is null;

    if p_newsletter then
        perform private.add_subscriber(v_email, 'checkin', true);
    end if;

    return jsonb_build_object(
        'confirmed', true,
        'event_id', v_event.id,
        'prods', (select p.prods from public.profiles p where p.id = v_user_id),
        'repeated', v_repeated
    );
end;
$$;

revoke execute on function private.check_in(text, text, boolean) from public;
grant execute on function private.check_in(text, text, boolean) to anon, authenticated;

create function public.check_in(p_code text, p_email text, p_newsletter boolean)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.check_in(p_code, p_email, p_newsletter);
$$;

revoke execute on function public.check_in(text, text, boolean) from public;
grant execute on function public.check_in(text, text, boolean) to anon, authenticated;

create function public.claim_checkins()
returns integer
language sql
security invoker
set search_path = ''
as $$
    select private.claim_checkins();
$$;

revoke execute on function public.claim_checkins() from public, anon;
grant execute on function public.claim_checkins() to authenticated;

create function public.get_door_code()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select private.get_door_code();
$$;

revoke execute on function public.get_door_code() from public, anon;
grant execute on function public.get_door_code() to authenticated;

create function public.get_door_event(p_code text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select private.find_door_event(p_code);
$$;

revoke execute on function public.get_door_event(text) from public;
grant execute on function public.get_door_event(text) to anon, authenticated;

create function public.get_account()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select jsonb_build_object(
        'admin', (select private.is_admin()),
        'method', coalesce((select auth.jwt()) -> 'amr' -> 0 ->> 'method', (select auth.jwt()) -> 'amr' ->> 0),
        'pending', exists (select 1 from public.checkins c where c.email = lower((select auth.jwt()) ->> 'email')),
        'profile', (select to_jsonb(p) - 'terms_accepted_at' from public.profiles p where p.id = (select auth.uid()))
    );
$$;

revoke execute on function public.get_account() from public, anon;
grant execute on function public.get_account() to authenticated;

create function private.check_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not private.is_switch_open('signups') then
        raise exception 'signups_closed';
    end if;

    return new;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id)
    values (new.id);

    perform private.add_prods(new.id, 1, 'Welcome Prod');

    return new;
end;
$$;

create trigger users_check_signups
before insert on auth.users
for each row execute function private.check_signups();

create trigger users_handle_new_user
after insert on auth.users
for each row execute function private.handle_new_user();
