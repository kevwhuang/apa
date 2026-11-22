create table public.prods_entries (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles (id) on delete cascade,
    amount integer not null check (amount <> 0),
    reason text not null check (char_length(reason) between 1 and 120),
    created_at timestamptz not null default now()
);

comment on table public.prods_entries is 'Append-only Prods ledger. Written only by private.add_prods; profiles.prods is its running sum.';

create index prods_entries_user_id_id_idx on public.prods_entries (user_id, id);

alter table public.prods_entries enable row level security;

revoke all on table public.prods_entries from anon, authenticated, service_role;
grant select on table public.prods_entries to authenticated;

create policy prods_entries_select_own_or_admin on public.prods_entries
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create view public.prods_ledger
with (security_invoker = true)
as
select
    e.id,
    e.user_id,
    e.amount,
    e.reason,
    e.created_at,
    (sum(e.amount) over (partition by e.user_id order by e.id))::integer as balance
from public.prods_entries e;

comment on view public.prods_ledger is 'prods_entries with the running balance per member. Runs as the caller, so RLS on prods_entries decides the rows.';

revoke all on table public.prods_ledger from anon, authenticated, service_role;
grant select on table public.prods_ledger to authenticated;

create function private.apply_prods_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles p set prods = p.prods + new.amount where p.id = new.user_id;

    return null;
end;
$$;

create trigger prods_entries_apply
after insert on public.prods_entries
for each row execute function private.apply_prods_entry();

create function private.add_prods(p_user_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_balance integer;
begin
    select p.prods into v_balance from public.profiles p where p.id = p_user_id for update;

    if not found then
        raise exception 'member_unknown';
    end if;

    if v_balance + p_amount < 0 then
        raise exception 'prods_negative';
    end if;

    insert into public.prods_entries (user_id, amount, reason)
    values (p_user_id, p_amount, btrim(p_reason));

    return v_balance + p_amount;
end;
$$;

revoke execute on function private.add_prods(uuid, integer, text) from public;

create function private.adjust_prods(p_user_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not (select private.is_admin()) then
        raise exception 'not_admin' using errcode = '42501';
    end if;

    if p_amount is null or p_amount = 0 or abs(p_amount) > 100 then
        raise exception 'prods_amount_invalid';
    end if;

    if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 80 then
        raise exception 'prods_reason_invalid';
    end if;

    return private.add_prods(p_user_id, p_amount, p_reason);
end;
$$;

revoke execute on function private.adjust_prods(uuid, integer, text) from public;
grant execute on function private.adjust_prods(uuid, integer, text) to authenticated;

create function public.adjust_prods(p_user_id uuid, p_amount integer, p_reason text)
returns integer
language sql
security invoker
set search_path = ''
as $$
    select private.adjust_prods(p_user_id, p_amount, p_reason);
$$;

revoke execute on function public.adjust_prods(uuid, integer, text) from public, anon;
grant execute on function public.adjust_prods(uuid, integer, text) to authenticated;

create function private.get_members()
returns table (id uuid, email text, artist_name text, created_at timestamptz, prods integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not (select private.is_admin()) then
        raise exception 'not_admin' using errcode = '42501';
    end if;

    return query
    select p.id, u.email::text, p.artist_name, p.created_at, p.prods
    from public.profiles p
    join auth.users u on u.id = p.id
    order by lower(coalesce(nullif(p.artist_name, ''), u.email::text)), p.id;
end;
$$;

revoke execute on function private.get_members() from public;
grant execute on function private.get_members() to authenticated;

create function public.get_members()
returns table (id uuid, email text, artist_name text, created_at timestamptz, prods integer)
language sql
stable
security invoker
set search_path = ''
as $$
    select m.id, m.email, m.artist_name, m.created_at, m.prods from private.get_members() m;
$$;

revoke execute on function public.get_members() from public, anon;
grant execute on function public.get_members() to authenticated;
