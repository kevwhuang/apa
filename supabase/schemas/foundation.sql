create extension if not exists vector with schema extensions;

grant usage on schema private to anon, authenticated, service_role;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();

    return new;
end;
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from auth.users u
        where u.id = (select auth.uid())
            and u.email = 'kevin@austinproduceralliance.com'
            and u.email_confirmed_at is not null
    );
$$;

revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
