create table public.newsletter_subscribers (
    email text primary key,
    status text not null default 'subscribed',
    source text not null default 'home',
    unsubscribe_token uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now(),
    subscribed_at timestamptz not null default now(),
    unsubscribed_at timestamptz,
    constraint newsletter_subscribers_email_check check (
        email = lower(email)
        and char_length(email) <= 254
        and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
    ),
    constraint newsletter_subscribers_source_check check (source in ('checkin', 'home')),
    constraint newsletter_subscribers_status_check check (status in ('subscribed', 'unsubscribed')),
    constraint newsletter_subscribers_unsubscribe_token_key unique (unsubscribe_token),
    constraint newsletter_subscribers_unsubscribed_at_check check ((status = 'unsubscribed') = (unsubscribed_at is not null))
);

comment on table public.newsletter_subscribers is 'The dispatch list, keyed by address so people without an account can be on it. A row is kept when its address unsubscribes, and only the signed-in owner of that address can subscribe it again.';

create index newsletter_subscribers_created_at_idx on public.newsletter_subscribers (created_at);

alter table public.newsletter_subscribers enable row level security;

revoke all on table public.newsletter_subscribers from anon, authenticated, service_role;
grant select (email, status) on table public.newsletter_subscribers to authenticated;

create policy newsletter_subscribers_select_own on public.newsletter_subscribers
for select to authenticated
using (email = lower((select auth.jwt()) ->> 'email'));

create function private.add_subscriber(p_email text, p_source text, p_is_owner boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_token uuid;
begin
    insert into public.newsletter_subscribers as s (email, source)
    values (v_email, p_source)
    on conflict (email) do nothing
    returning s.unsubscribe_token into v_token;

    if v_token is null and p_is_owner then
        update public.newsletter_subscribers s
        set source = p_source,
            status = 'subscribed',
            subscribed_at = now(),
            unsubscribed_at = null
        where s.email = v_email and s.status = 'unsubscribed'
        returning s.unsubscribe_token into v_token;
    end if;

    return v_token;
end;
$$;

revoke execute on function private.add_subscriber(text, text, boolean) from public;
grant execute on function private.add_subscriber(text, text, boolean) to service_role;

create function private.subscribe_newsletter(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
begin
    if (
        select count(*)
        from public.newsletter_subscribers s
        where s.source = 'home' and s.created_at > now() - interval '1 hour'
    ) >= 200 then
        raise exception 'newsletter_flooded';
    end if;

    perform private.add_subscriber(
        v_email,
        'home',
        exists (
            select 1
            from auth.users u
            where u.id = (select auth.uid()) and u.email = v_email and u.email_confirmed_at is not null
        )
    );
end;
$$;

revoke execute on function private.subscribe_newsletter(text) from public;
grant execute on function private.subscribe_newsletter(text) to anon, authenticated;

create function private.unsubscribe_newsletter(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.newsletter_subscribers s
    set status = 'unsubscribed', unsubscribed_at = now()
    where s.unsubscribe_token = p_token and s.status = 'subscribed';

    return exists (select 1 from public.newsletter_subscribers s where s.unsubscribe_token = p_token);
end;
$$;

revoke execute on function private.unsubscribe_newsletter(uuid) from public;
grant execute on function private.unsubscribe_newsletter(uuid) to anon, authenticated;

create function public.subscribe_newsletter(p_email text)
returns void
language sql
security invoker
set search_path = ''
as $$
    select private.subscribe_newsletter(p_email);
$$;

revoke execute on function public.subscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

create function public.add_subscriber(p_email text, p_is_owner boolean)
returns uuid
language sql
security invoker
set search_path = ''
as $$
    select private.add_subscriber(p_email, 'home', p_is_owner);
$$;

revoke execute on function public.add_subscriber(text, boolean) from public, anon, authenticated;
grant execute on function public.add_subscriber(text, boolean) to service_role;

create function public.unsubscribe_newsletter(p_token uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
    select private.unsubscribe_newsletter(p_token);
$$;

revoke execute on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;
