create table public.switches (
    id text primary key check (id in ('assembly_intake', 'bash_intake', 'check_in', 'signups')),
    is_open boolean not null default true,
    updated_at timestamptz not null default now()
);

comment on table public.switches is 'The four admin switches. Read by everyone, flipped only by the admin, enforced inside Postgres.';

insert into public.switches (id)
values ('assembly_intake'), ('bash_intake'), ('check_in'), ('signups');

alter table public.switches enable row level security;

revoke all on table public.switches from anon, authenticated, service_role;
grant select on table public.switches to anon, authenticated;
grant update (is_open) on table public.switches to authenticated;

create policy switches_select_all on public.switches
for select to anon, authenticated
using (true);

create policy switches_update_admin on public.switches
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create trigger switches_set_updated_at
before update on public.switches
for each row execute function private.set_updated_at();

create function private.is_switch_open(p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce((select s.is_open from public.switches s where s.id = p_id), false);
$$;

revoke execute on function private.is_switch_open(text) from public;

create function private.broadcast_switch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.id in ('assembly_intake', 'bash_intake') and new.is_open is distinct from old.is_open then
        perform realtime.send(
            jsonb_build_object('id', new.id, 'is_open', new.is_open),
            'switch_changed',
            'board:' || split_part(new.id, '_', 1),
            true
        );
    end if;

    return null;
end;
$$;

create trigger switches_broadcast
after update on public.switches
for each row execute function private.broadcast_switch();
