create schema if not exists private;

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

create table public.events (
    id text primary key check (id ~ '^\d{4}_\d{2}_(assembly|bash|hangout)(_\d+)?$'),
    program text not null check (program in ('assembly', 'bash', 'hangout')),
    label text not null check (char_length(label) between 1 and 100),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    updated_at timestamptz not null default now(),
    constraint events_window_check check (ends_at > starts_at)
);

comment on table public.events is 'Mirror of the src/content/events collection, keyed by its entry id. Postgres reads it for check-in windows and the current board event. Synced by POST /api/sync as the admin, which also retires rows for events that left the collection before they began.';

create index events_program_ends_at_idx on public.events (program, ends_at);

alter table public.events enable row level security;

revoke all on table public.events from anon, authenticated, service_role;
grant select, insert, update, delete on table public.events to authenticated;

create policy events_select_member on public.events
for select to authenticated
using (true);

create policy events_insert_admin on public.events
for insert to authenticated
with check ((select private.is_admin()));

create policy events_update_admin on public.events
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy events_delete_admin on public.events
for delete to authenticated
using ((select private.is_admin()) and starts_at > now() + interval '1 hour');

create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();

create function public.current_event_id(p_board text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select e.id
    from public.events e
    where e.program = p_board and e.ends_at > now() - interval '12 hours'
    order by e.starts_at
    limit 1;
$$;

revoke execute on function public.current_event_id(text) from public, anon;
grant execute on function public.current_event_id(text) to authenticated;

insert into public.events (id, program, label, starts_at, ends_at)
values
    ('2022_05_hangout_1', 'hangout', 'i 2022 Hangout', '2022-05-14T14:00:00-05:00', '2022-05-14T16:00:00-05:00'),
    ('2022_05_hangout_2', 'hangout', 'ii 2022 Hangout', '2022-05-21T14:00:00-05:00', '2022-05-21T16:00:00-05:00'),
    ('2022_06_hangout_1', 'hangout', 'iii 2022 Hangout', '2022-06-04T14:00:00-05:00', '2022-06-04T16:00:00-05:00'),
    ('2022_06_hangout_2', 'hangout', 'iv 2022 Hangout', '2022-06-25T14:00:00-05:00', '2022-06-25T16:00:00-05:00'),
    ('2022_07_bash', 'bash', 'Fall 2022 Bash', '2022-07-30T12:00:00-05:00', '2022-07-30T17:00:00-05:00'),
    ('2022_07_hangout_1', 'hangout', 'v 2022 Hangout', '2022-07-09T14:00:00-05:00', '2022-07-09T16:00:00-05:00'),
    ('2022_07_hangout_2', 'hangout', 'vi 2022 Hangout', '2022-07-23T14:00:00-05:00', '2022-07-23T16:00:00-05:00'),
    ('2022_08_hangout_1', 'hangout', 'vii 2022 Hangout', '2022-08-06T14:00:00-05:00', '2022-08-06T16:00:00-05:00'),
    ('2022_08_hangout_2', 'hangout', 'viii 2022 Hangout', '2022-08-20T14:00:00-05:00', '2022-08-20T16:00:00-05:00'),
    ('2022_09_hangout', 'hangout', 'ix 2022 Hangout', '2022-09-17T14:00:00-05:00', '2022-09-17T16:00:00-05:00'),
    ('2022_10_bash', 'bash', 'Winter 2022 Bash', '2022-10-15T12:00:00-05:00', '2022-10-15T17:00:00-05:00'),
    ('2022_10_hangout', 'hangout', 'x 2022 Hangout', '2022-10-09T14:00:00-05:00', '2022-10-09T16:00:00-05:00'),
    ('2022_11_hangout', 'hangout', 'xi 2022 Hangout', '2022-11-12T14:00:00-06:00', '2022-11-12T16:00:00-06:00'),
    ('2022_12_hangout_1', 'hangout', 'xii 2022 Hangout', '2022-12-04T14:00:00-06:00', '2022-12-04T16:00:00-06:00'),
    ('2022_12_hangout_2', 'hangout', 'xiii 2022 Hangout', '2022-12-18T14:00:00-06:00', '2022-12-18T16:00:00-06:00'),
    ('2023_01_assembly', 'assembly', e'January 2023 Assembly \u00b7 Asher Nu', '2023-01-09T19:00:00-06:00', '2023-01-09T21:00:00-06:00'),
    ('2023_01_hangout', 'hangout', 'i 2023 Hangout', '2023-01-22T14:00:00-06:00', '2023-01-22T16:00:00-06:00'),
    ('2023_02_assembly', 'assembly', e'February 2023 Assembly \u00b7 Asher Nu', '2023-02-13T19:00:00-06:00', '2023-02-13T21:00:00-06:00'),
    ('2023_02_bash', 'bash', 'Spring 2023 Bash', '2023-02-25T12:00:00-06:00', '2023-02-25T17:00:00-06:00'),
    ('2023_02_hangout', 'hangout', 'ii 2023 Hangout', '2023-02-05T14:00:00-06:00', '2023-02-05T16:00:00-06:00'),
    ('2023_03_assembly', 'assembly', 'March 2023 Assembly', '2023-03-20T19:00:00-05:00', '2023-03-20T21:00:00-05:00'),
    ('2023_03_hangout', 'hangout', 'iii 2023 Hangout', '2023-03-05T14:00:00-06:00', '2023-03-05T16:00:00-06:00'),
    ('2023_04_assembly', 'assembly', 'April 2023 Assembly', '2023-04-10T19:00:00-05:00', '2023-04-10T21:00:00-05:00'),
    ('2023_04_bash', 'bash', 'Summer I 2023 Bash', '2023-04-01T14:00:00-05:00', '2023-04-01T17:30:00-05:00'),
    ('2023_05_assembly', 'assembly', 'May 2023 Assembly', '2023-05-08T19:00:00-05:00', '2023-05-08T21:00:00-05:00'),
    ('2023_05_bash', 'bash', 'Summer II 2023 Bash', '2023-05-27T12:00:00-05:00', '2023-05-27T17:00:00-05:00'),
    ('2023_06_assembly', 'assembly', 'June 2023 Assembly', '2023-06-12T19:00:00-05:00', '2023-06-12T21:00:00-05:00'),
    ('2023_06_hangout', 'hangout', 'iv 2023 Hangout', '2023-06-24T14:00:00-05:00', '2023-06-24T16:00:00-05:00'),
    ('2023_07_assembly', 'assembly', e'July 2023 Assembly \u00b7 Alt Slauson', '2023-07-10T19:00:00-05:00', '2023-07-10T21:00:00-05:00'),
    ('2023_07_bash', 'bash', 'Fall I 2023 Bash', '2023-07-02T14:00:00-05:00', '2023-07-02T17:30:00-05:00'),
    ('2023_08_assembly', 'assembly', e'August 2023 Assembly \u00b7 Lonely Child', '2023-08-14T19:00:00-05:00', '2023-08-14T21:00:00-05:00'),
    ('2023_08_bash', 'bash', 'Fall II 2023 Bash', '2023-08-26T14:00:00-05:00', '2023-08-26T17:30:00-05:00'),
    ('2023_09_assembly', 'assembly', 'September 2023 Assembly', '2023-09-11T19:00:00-05:00', '2023-09-11T21:00:00-05:00'),
    ('2023_10_assembly', 'assembly', e'October 2023 Assembly \u00b7 Alt Slauson', '2023-10-09T19:00:00-05:00', '2023-10-09T21:00:00-05:00'),
    ('2023_10_bash', 'bash', 'Winter I 2023 Bash', '2023-10-21T14:00:00-05:00', '2023-10-21T17:30:00-05:00'),
    ('2023_11_assembly', 'assembly', e'November 2023 Assembly \u00b7 Material Soul', '2023-11-13T19:00:00-06:00', '2023-11-13T21:00:00-06:00'),
    ('2023_12_assembly', 'assembly', e'December 2023 Assembly \u00b7 Alt Slauson', '2023-12-11T19:00:00-06:00', '2023-12-11T21:00:00-06:00'),
    ('2023_12_bash', 'bash', 'Winter II 2023 Bash', '2023-12-02T14:00:00-06:00', '2023-12-02T17:30:00-06:00'),
    ('2024_01_assembly', 'assembly', 'January 2024 Assembly', '2024-01-10T19:00:00-06:00', '2024-01-10T21:00:00-06:00'),
    ('2024_01_bash', 'bash', 'Spring I 2024 Bash', '2024-01-27T14:00:00-06:00', '2024-01-27T17:30:00-06:00'),
    ('2024_02_assembly', 'assembly', e'February 2024 Assembly \u00b7 Henyx', '2024-02-06T19:00:00-06:00', '2024-02-06T21:00:00-06:00'),
    ('2024_02_bash', 'bash', 'Spring II 2024 Bash', '2024-02-24T14:00:00-06:00', '2024-02-24T17:30:00-06:00'),
    ('2024_03_assembly', 'assembly', e'March 2024 Assembly \u00b7 Den Zuko', '2024-03-20T19:00:00-05:00', '2024-03-20T21:00:00-05:00'),
    ('2024_04_assembly', 'assembly', e'April 2024 Assembly \u00b7 Justin M', '2024-04-10T19:00:00-05:00', '2024-04-10T21:00:00-05:00'),
    ('2024_04_hangout', 'hangout', 'House Party 2024 Hangout', '2024-04-27T19:00:00-05:00', '2024-04-28T02:00:00-05:00'),
    ('2024_05_assembly', 'assembly', e'May 2024 Assembly \u00b7 Kai Castro', '2024-05-08T19:00:00-05:00', '2024-05-08T21:00:00-05:00'),
    ('2024_06_assembly', 'assembly', e'June 2024 Assembly \u00b7 Will Evans', '2024-06-12T19:00:00-05:00', '2024-06-12T21:00:00-05:00'),
    ('2024_06_bash', 'bash', 'Summer 2024 Bash', '2024-06-29T14:00:00-05:00', '2024-06-29T17:30:00-05:00'),
    ('2024_07_assembly', 'assembly', 'July 2024 Assembly', '2024-07-10T19:00:00-05:00', '2024-07-10T21:00:00-05:00'),
    ('2024_08_assembly', 'assembly', 'August 2024 Assembly', '2024-08-14T19:00:00-05:00', '2024-08-14T21:00:00-05:00'),
    ('2024_09_assembly', 'assembly', 'September 2024 Assembly', '2024-09-11T19:00:00-05:00', '2024-09-11T21:00:00-05:00'),
    ('2024_09_bash', 'bash', 'Fall 2024 Bash', '2024-09-28T14:00:00-05:00', '2024-09-28T17:30:00-05:00'),
    ('2024_10_assembly', 'assembly', 'October 2024 Assembly', '2024-10-09T19:00:00-05:00', '2024-10-09T21:00:00-05:00'),
    ('2024_11_assembly', 'assembly', 'November 2024 Assembly', '2024-11-13T19:00:00-06:00', '2024-11-13T21:00:00-06:00'),
    ('2024_12_assembly', 'assembly', e'December 2024 Assembly \u00b7 Justin M', '2024-12-04T19:00:00-06:00', '2024-12-04T21:00:00-06:00'),
    ('2025_01_assembly', 'assembly', e'January 2025 Assembly \u00b7 Boomchii', '2025-01-16T18:00:00-06:00', '2025-01-16T21:00:00-06:00'),
    ('2025_02_assembly', 'assembly', e'February 2025 Assembly \u00b7 Shane Hazleton', '2025-02-13T18:00:00-06:00', '2025-02-13T21:00:00-06:00'),
    ('2025_02_bash', 'bash', 'Spring 2025 Bash', '2025-02-01T13:30:00-06:00', '2025-02-01T18:00:00-06:00'),
    ('2025_03_assembly', 'assembly', e'March 2025 Assembly \u00b7 DREAMSHIFT', '2025-03-20T18:00:00-05:00', '2025-03-20T21:00:00-05:00'),
    ('2025_04_assembly', 'assembly', e'April 2025 Assembly \u00b7 Alt Slauson', '2025-04-10T18:00:00-05:00', '2025-04-10T21:00:00-05:00'),
    ('2025_04_bash', 'bash', 'Summer 2025 Bash', '2025-04-26T13:30:00-05:00', '2025-04-26T18:00:00-05:00'),
    ('2025_05_assembly', 'assembly', e'May 2025 Assembly \u00b7 Jonathan Bolton', '2025-05-08T18:00:00-05:00', '2025-05-08T21:00:00-05:00'),
    ('2025_06_assembly', 'assembly', e'June 2025 Assembly \u00b7 Henyx', '2025-06-07T13:30:00-05:00', '2025-06-07T17:00:00-05:00'),
    ('2025_07_assembly', 'assembly', e'July 2025 Assembly \u00b7 Justin M', '2025-07-10T18:00:00-05:00', '2025-07-10T21:00:00-05:00'),
    ('2025_08_assembly', 'assembly', e'August 2025 Assembly \u00b7 Austin Breckenridge', '2025-08-14T18:00:00-05:00', '2025-08-14T21:00:00-05:00'),
    ('2025_09_assembly', 'assembly', e'September 2025 Assembly \u00b7 DONPAIRION', '2025-09-11T18:00:00-05:00', '2025-09-11T21:00:00-05:00'),
    ('2025_09_bash', 'bash', 'Fall 2025 Bash', '2025-09-27T13:30:00-05:00', '2025-09-27T18:00:00-05:00'),
    ('2025_10_assembly', 'assembly', e'October 2025 Assembly \u00b7 Alex LaCroix', '2025-10-09T18:00:00-05:00', '2025-10-09T21:00:00-05:00'),
    ('2025_10_bash', 'bash', 'Winter 2025 Bash', '2025-10-25T13:30:00-05:00', '2025-10-25T18:00:00-05:00'),
    ('2025_11_assembly', 'assembly', 'November 2025 Assembly', '2025-11-18T18:00:00-06:00', '2025-11-18T21:00:00-06:00'),
    ('2025_12_assembly', 'assembly', 'December 2025 Assembly', '2025-12-11T18:00:00-06:00', '2025-12-11T21:00:00-06:00'),
    ('2026_01_assembly', 'assembly', 'January 2026 Assembly', '2026-01-15T18:00:00-06:00', '2026-01-15T21:00:00-06:00'),
    ('2026_02_assembly', 'assembly', 'February 2026 Assembly', '2026-02-12T18:00:00-06:00', '2026-02-12T21:00:00-06:00'),
    ('2026_02_bash', 'bash', 'Spring 2026 Bash', '2026-02-28T13:30:00-06:00', '2026-02-28T18:00:00-06:00'),
    ('2026_04_assembly', 'assembly', 'April 2026 Assembly', '2026-04-09T18:00:00-05:00', '2026-04-09T21:00:00-05:00'),
    ('2026_04_bash', 'bash', 'Summer 2026 Bash', '2026-04-25T13:30:00-05:00', '2026-04-25T18:00:00-05:00'),
    ('2026_05_assembly', 'assembly', e'May 2026 Assembly \u00b7 VonRyk', '2026-05-21T18:00:00-05:00', '2026-05-21T21:00:00-05:00'),
    ('2026_06_assembly', 'assembly', e'June 2026 Assembly \u00b7 Alex LaCroix', '2026-06-11T18:00:00-05:00', '2026-06-11T21:00:00-05:00'),
    ('2026_07_assembly', 'assembly', e'July 2026 Assembly \u00b7 dk darkly', '2026-07-09T18:00:00-05:00', '2026-07-09T21:00:00-05:00'),
    ('2026_07_bash', 'bash', 'Fall 2026 Bash', '2026-07-25T13:30:00-05:00', '2026-07-25T18:00:00-05:00'),
    ('2026_08_assembly', 'assembly', e'August 2026 Assembly \u00b7 DONPAIRION', '2026-08-13T18:00:00-05:00', '2026-08-13T21:00:00-05:00'),
    ('2026_09_assembly', 'assembly', e'September 2026 Assembly \u00b7 Jameson Sutton', '2026-09-10T18:00:00-05:00', '2026-09-10T21:00:00-05:00'),
    ('2026_10_assembly', 'assembly', 'October 2026 Assembly', '2026-10-08T18:00:00-05:00', '2026-10-08T21:00:00-05:00'),
    ('2026_11_assembly', 'assembly', e'November 2026 Assembly \u00b7 Alt Slauson', '2026-11-12T18:00:00-06:00', '2026-11-12T21:00:00-06:00'),
    ('2026_12_assembly', 'assembly', 'December 2026 Assembly', '2026-12-10T18:00:00-06:00', '2026-12-10T21:00:00-06:00'),
    ('2027_01_assembly', 'assembly', 'January 2027 Assembly', '2027-01-14T18:00:00-06:00', '2027-01-14T21:00:00-06:00'),
    ('2027_01_hangout', 'hangout', 'i 2027 Hangout', '2027-01-26T19:00:00-06:00', '2027-01-26T22:00:00-06:00'),
    ('2027_02_assembly', 'assembly', 'February 2027 Assembly', '2027-02-11T18:00:00-06:00', '2027-02-11T21:00:00-06:00'),
    ('2027_02_bash', 'bash', 'Spring 2027 Bash', '2027-02-20T13:00:00-06:00', '2027-02-20T18:00:00-06:00'),
    ('2027_02_hangout', 'hangout', 'ii 2027 Hangout', '2027-02-23T19:00:00-06:00', '2027-02-23T22:00:00-06:00'),
    ('2027_03_assembly', 'assembly', 'March 2027 Assembly', '2027-03-11T18:00:00-06:00', '2027-03-11T21:00:00-06:00'),
    ('2027_03_hangout', 'hangout', 'iii 2027 Hangout', '2027-03-23T19:00:00-05:00', '2027-03-23T22:00:00-05:00'),
    ('2027_04_assembly', 'assembly', 'April 2027 Assembly', '2027-04-08T18:00:00-05:00', '2027-04-08T21:00:00-05:00'),
    ('2027_04_hangout', 'hangout', 'iv 2027 Hangout', '2027-04-27T19:00:00-05:00', '2027-04-27T22:00:00-05:00'),
    ('2027_05_assembly', 'assembly', 'May 2027 Assembly', '2027-05-13T18:00:00-05:00', '2027-05-13T21:00:00-05:00'),
    ('2027_05_bash', 'bash', 'Summer 2027 Bash', '2027-05-22T13:00:00-05:00', '2027-05-22T18:00:00-05:00'),
    ('2027_05_hangout', 'hangout', 'v 2027 Hangout', '2027-05-25T19:00:00-05:00', '2027-05-25T22:00:00-05:00'),
    ('2027_06_assembly', 'assembly', 'June 2027 Assembly', '2027-06-10T18:00:00-05:00', '2027-06-10T21:00:00-05:00'),
    ('2027_06_hangout', 'hangout', 'vi 2027 Hangout', '2027-06-22T19:00:00-05:00', '2027-06-22T22:00:00-05:00'),
    ('2027_07_assembly', 'assembly', 'July 2027 Assembly', '2027-07-08T18:00:00-05:00', '2027-07-08T21:00:00-05:00'),
    ('2027_07_hangout', 'hangout', 'vii 2027 Hangout', '2027-07-27T19:00:00-05:00', '2027-07-27T22:00:00-05:00'),
    ('2027_08_assembly', 'assembly', 'August 2027 Assembly', '2027-08-12T18:00:00-05:00', '2027-08-12T21:00:00-05:00'),
    ('2027_08_bash', 'bash', 'Fall 2027 Bash', '2027-08-21T13:00:00-05:00', '2027-08-21T18:00:00-05:00'),
    ('2027_08_hangout', 'hangout', 'viii 2027 Hangout', '2027-08-24T19:00:00-05:00', '2027-08-24T22:00:00-05:00'),
    ('2027_09_assembly', 'assembly', 'September 2027 Assembly', '2027-09-09T18:00:00-05:00', '2027-09-09T21:00:00-05:00'),
    ('2027_09_hangout', 'hangout', 'ix 2027 Hangout', '2027-09-28T19:00:00-05:00', '2027-09-28T22:00:00-05:00'),
    ('2027_10_assembly', 'assembly', 'October 2027 Assembly', '2027-10-14T18:00:00-05:00', '2027-10-14T21:00:00-05:00'),
    ('2027_10_hangout', 'hangout', 'x 2027 Hangout', '2027-10-26T19:00:00-05:00', '2027-10-26T22:00:00-05:00'),
    ('2027_11_assembly', 'assembly', 'November 2027 Assembly', '2027-11-11T18:00:00-06:00', '2027-11-11T21:00:00-06:00'),
    ('2027_11_bash', 'bash', 'Winter 2027 Bash', '2027-11-20T13:00:00-06:00', '2027-11-20T18:00:00-06:00'),
    ('2027_11_hangout', 'hangout', 'xi 2027 Hangout', '2027-11-23T19:00:00-06:00', '2027-11-23T22:00:00-06:00'),
    ('2027_12_assembly', 'assembly', 'December 2027 Assembly', '2027-12-09T18:00:00-06:00', '2027-12-09T21:00:00-06:00'),
    ('2027_12_hangout', 'hangout', 'xii 2027 Hangout', '2027-12-28T19:00:00-06:00', '2027-12-28T22:00:00-06:00');

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    artist_name text not null default '' check (char_length(artist_name) <= 50),
    avatar_path text not null default '' check (avatar_path = '' or avatar_path like id::text || '/%'),
    bio text not null default '' check (char_length(bio) <= 400),
    city text not null default '' check (char_length(city) <= 80),
    genres text[] not null default '{}' check (
        cardinality(genres) <= 21
        and genres <@ array[
            'afrobeats', 'ambient', 'disco', 'drum & bass', 'dubstep', 'experimental', 'folk',
            'funk', 'hip-hop', 'house', 'indie', 'jazz', 'Latin', 'lo-fi', 'pop', 'R&B', 'rock',
            'soul', 'techno', 'trap', 'urbano'
        ]
    ),
    instagram_url text not null default '' check (instagram_url = '' or (char_length(instagram_url) <= 100 and instagram_url ~* '^https?://\S+\.\S+$')),
    onboarded boolean not null default false,
    prods integer not null default 0 check (prods >= 0),
    role text not null default 'fan' check (role in ('artist', 'engineer', 'fan', 'producer')),
    soundcloud_url text not null default '' check (soundcloud_url = '' or (char_length(soundcloud_url) <= 100 and soundcloud_url ~* '^https?://\S+\.\S+$')),
    spotify_url text not null default '' check (spotify_url = '' or (char_length(spotify_url) <= 100 and spotify_url ~* '^https?://\S+\.\S+$')),
    state text not null default '' check (state = '' or state ~ '^[A-Z]{2}$'),
    terms_accepted_at timestamptz,
    track_name text not null default '' check (char_length(track_name) <= 255),
    track_path text not null default '' check (track_path = '' or track_path like id::text || '/spotlight/%'),
    youtube_url text not null default '' check (youtube_url = '' or (char_length(youtube_url) <= 100 and youtube_url ~* '^https?://\S+\.\S+$')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per account: everything settings and onboarding edit, plus the Prods balance kept in step with prods_entries. Readable by its owner and the admin.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (
    artist_name, avatar_path, bio, city, genres, instagram_url, onboarded, role,
    soundcloud_url, spotify_url, state, track_name, track_path, youtube_url
) on table public.profiles to authenticated;

create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.broadcast_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(to_jsonb(new) - 'terms_accepted_at', 'profile', 'account:' || new.id::text, true);

    return null;
end;
$$;

create trigger profiles_broadcast
after update on public.profiles
for each row execute function private.broadcast_profile();

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

create table public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    author_name text not null check (char_length(author_name) between 1 and 50),
    body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
    created_at timestamptz not null default now()
);

comment on table public.chat_messages is 'Member chat history for the one room. Broadcast delivers new rows; this table is what a late joiner pages through.';

create index chat_messages_created_at_id_idx on public.chat_messages (created_at desc, id desc);
create index chat_messages_user_id_created_at_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

revoke all on table public.chat_messages from anon, authenticated, service_role;
grant select on table public.chat_messages to authenticated;
grant insert (id, body) on table public.chat_messages to authenticated;

create policy chat_messages_select_member on public.chat_messages
for select to authenticated
using (true);

create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated
with check (user_id = (select auth.uid()));

create function private.prepare_chat_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if (
        select count(*)
        from public.chat_messages m
        where m.user_id = new.user_id and m.created_at > now() - interval '10 seconds'
    ) >= 5 then
        raise exception 'chat_rate_limited';
    end if;

    if (
        select count(*)
        from public.chat_messages m
        where m.user_id = new.user_id and m.created_at > now() - interval '24 hours'
    ) >= 300 then
        raise exception 'chat_rate_limited';
    end if;

    new.author_name := coalesce(
        (select left(nullif(btrim(p.artist_name), ''), 50) from public.profiles p where p.id = new.user_id),
        'Member'
    );
    new.created_at := now();

    return new;
end;
$$;

create function private.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        perform realtime.send(to_jsonb(new), 'message_created', 'chat:global', true);
    else
        perform realtime.send(jsonb_build_object('id', old.id), 'message_deleted', 'chat:global', true);
    end if;

    return null;
end;
$$;

create trigger chat_messages_prepare
before insert on public.chat_messages
for each row execute function private.prepare_chat_message();

create trigger chat_messages_broadcast
after insert or delete on public.chat_messages
for each row execute function private.broadcast_chat_message();

create table public.submissions (
    id uuid primary key default gen_random_uuid(),
    board text not null check (board in ('assembly', 'bash')),
    event_id text not null references public.events (id) on delete cascade,
    user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    producer_name text not null check (char_length(producer_name) between 1 and 50),
    link_url text check (
        char_length(link_url) <= 255
        and link_url ~ '^https://([a-z0-9-]+\.)*(snd\.sc|soundcloud\.com|spotify\.com|spotify\.link)/[^[:space:]?#]*[^[:space:]?#/]$'
    ),
    file_name text check (char_length(file_name) between 1 and 255),
    file_bytes bigint check (file_bytes between 1 and 52428800),
    storage_path text unique,
    created_at timestamptz not null default now(),
    constraint submissions_source_check check (
        (link_url is not null and file_name is null and file_bytes is null and storage_path is null)
        or (link_url is null and file_name is not null and file_bytes is not null and storage_path is not null)
    ),
    constraint submissions_bash_check check (board <> 'bash' or link_url is null)
);

comment on table public.submissions is 'One row per queued link or uploaded file on the Assembly and Bash boards. The event, member, name, path, and size are stamped by trigger, never by the client. A queue goes with its event when a future event is retired.';

create index submissions_event_id_created_at_idx on public.submissions (event_id, created_at);
create index submissions_user_id_idx on public.submissions (user_id);
create unique index submissions_link_key on public.submissions (event_id, user_id, link_url) where link_url is not null;
create unique index submissions_file_key on public.submissions (event_id, user_id, file_name, file_bytes) where storage_path is not null;

alter table public.submissions enable row level security;

revoke all on table public.submissions from anon, authenticated, service_role;
grant select, delete on table public.submissions to authenticated;
grant insert (id, board, link_url, file_name) on table public.submissions to authenticated;

create policy submissions_select_member on public.submissions
for select to authenticated
using (true);

create policy submissions_insert_own on public.submissions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy submissions_delete_own_or_admin on public.submissions
for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create function private.prepare_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_id text := public.current_event_id(new.board);
    v_extension text := lower(substring(new.file_name from '\.([^.]+)$'));
    v_user_id uuid := (select auth.uid());
begin
    if v_user_id is null then
        raise exception 'not_signed_in' using errcode = '42501';
    end if;

    if v_event_id is null or not private.is_switch_open(new.board || '_intake') then
        raise exception 'intake_closed';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    if (select count(*) from public.submissions s where s.event_id = v_event_id and s.user_id = v_user_id) >= 3 then
        raise exception 'submission_limit';
    end if;

    new.created_at := now();
    new.event_id := v_event_id;
    new.producer_name := coalesce(
        (select left(nullif(btrim(p.artist_name), ''), 50) from public.profiles p where p.id = v_user_id),
        'Member'
    );
    new.user_id := v_user_id;

    if new.link_url is not null then
        return new;
    end if;

    if v_extension is null or v_extension not in ('mp3', 'wav') then
        raise exception 'file_type_invalid';
    end if;

    new.storage_path := v_user_id::text || '/' || v_event_id || '/' || new.id::text || '.' || v_extension;

    new.file_bytes := (
        select (o.metadata ->> 'size')::bigint
        from storage.objects o
        where o.bucket_id = 'tracks' and o.name = new.storage_path
    );

    if new.file_bytes is null then
        raise exception 'file_missing';
    end if;

    return new;
end;
$$;

create function private.broadcast_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        perform realtime.send(to_jsonb(new), 'submission_created', 'board:' || new.board, true);
    else
        perform realtime.send(jsonb_build_object('id', old.id), 'submission_deleted', 'board:' || old.board, true);
    end if;

    return null;
end;
$$;

create trigger submissions_prepare
before insert on public.submissions
for each row execute function private.prepare_submission();

create trigger submissions_broadcast
after insert or delete on public.submissions
for each row execute function private.broadcast_submission();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/webp']),
    ('tracks', 'tracks', false, 52428800, array['audio/mpeg', 'audio/wav'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function private.enforce_object_caps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cap integer;
    v_folders text[] := storage.foldername(new.name);
    v_prefix text;
begin
    if v_folders[1] is null then
        return new;
    end if;

    if new.bucket_id = 'avatars' then
        v_cap := 2;
        v_prefix := v_folders[1] || '/';
    elsif v_folders[2] = 'spotlight' then
        v_cap := 3;
        v_prefix := v_folders[1] || '/spotlight/';
    else
        if not exists (
            select 1
            from unnest(array['assembly', 'bash']) as b (board)
            where public.current_event_id(b.board) = v_folders[2]
                and private.is_switch_open(b.board || '_intake')
        ) then
            raise exception 'intake_closed';
        end if;

        v_cap := 4;
        v_prefix := v_folders[1] || '/' || v_folders[2] || '/';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(new.bucket_id || '/' || v_prefix, 0));

    if (
        select count(*)
        from storage.objects o
        where o.bucket_id = new.bucket_id and starts_with(o.name, v_prefix) and o.name <> new.name
    ) >= v_cap then
        raise exception 'object_limit';
    end if;

    return new;
end;
$$;

create trigger objects_enforce_caps
before insert on storage.objects
for each row
when (new.bucket_id in ('avatars', 'tracks'))
execute function private.enforce_object_caps();

create policy objects_insert_member on storage.objects
for insert to authenticated
with check (
    (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|webp)$'))
    or (bucket_id = 'tracks' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-z_]+/[0-9a-f-]{36}\.(mp3|wav)$'))
);

create policy objects_select_member on storage.objects
for select to authenticated
using (
    (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (
        bucket_id = 'tracks'
        and (
            (select private.is_admin())
            or (
                (storage.foldername(name))[1] = (select auth.uid())::text
                and (select storage.allow_any_operation(array['object.delete', 'object.delete_many']))
            )
        )
    )
);

create policy objects_delete_member on storage.objects
for delete to authenticated
using (
    (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (
        bucket_id = 'tracks'
        and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
    )
);

create function public.get_orphan_tracks()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
    select o.name
    from storage.objects o
    where o.bucket_id = 'tracks'
        and o.created_at < now() - interval '1 hour'
        and not exists (select 1 from public.submissions s where s.storage_path = o.name)
        and not exists (select 1 from public.profiles p where p.track_path = o.name)
    order by o.created_at
    limit 1000;
$$;

revoke execute on function public.get_orphan_tracks() from public, anon;
grant execute on function public.get_orphan_tracks() to authenticated;

create policy messages_select_member on realtime.messages
for select to authenticated
using (
    (
        realtime.messages.extension = 'broadcast'
        and (select realtime.topic()) = 'account:' || (select auth.uid())::text
    )
    or (
        realtime.messages.extension in ('broadcast', 'presence')
        and (select realtime.topic()) in ('board:assembly', 'board:bash', 'chat:global')
    )
);

create policy messages_insert_chat_presence on realtime.messages
for insert to authenticated
with check (realtime.messages.extension = 'presence' and (select realtime.topic()) = 'chat:global');

create table public.orders (
    id bigint generated always as identity primary key,
    number text generated always as ('APA-' || lpad(id::text, greatest(5, length(id::text)), '0')) stored,
    user_id uuid references public.profiles (id) on delete set null,
    email text not null check (char_length(email) between 3 and 254),
    status text not null default 'pending' check (status in ('canceled', 'paid', 'pending', 'refunded')),
    items jsonb not null check (jsonb_typeof(items) = 'array'),
    shipping jsonb not null check (jsonb_typeof(shipping) = 'object'),
    promo_code text check (char_length(promo_code) <= 20),
    subtotal_cents integer not null check (subtotal_cents > 0),
    promo_cents integer not null default 0 check (promo_cents >= 0),
    tax_cents integer not null default 0 check (tax_cents >= 0),
    shipping_cents integer not null default 0 check (shipping_cents >= 0),
    prods_applied integer not null default 0 check (prods_applied >= 0),
    prods_cents integer not null default 0 check (prods_cents between 0 and prods_applied * 100),
    prods_debited integer not null default 0,
    total_cents integer not null check (total_cents >= 0),
    stripe_payment_intent_id text unique,
    placed_at timestamptz not null default now(),
    paid_at timestamptz,
    constraint orders_prods_debited_check check (prods_debited between 0 and prods_applied),
    constraint orders_total_check check (total_cents = subtotal_cents - promo_cents + tax_cents + shipping_cents - prods_cents)
);

comment on table public.orders is 'One row per checkout attempt with its priced line items and address as an immutable snapshot. Written only by the order functions as service_role; members read their own. prods_debited is what settlement actually took, and what a refund gives back.';

create index orders_pending_placed_at_idx on public.orders (placed_at) where status = 'pending';
create index orders_user_id_placed_at_idx on public.orders (user_id, placed_at desc);

alter table public.orders enable row level security;

revoke all on table public.orders from anon, authenticated, service_role;
grant select on table public.orders to authenticated;
grant select, update on table public.orders to service_role;

create policy orders_select_own on public.orders
for select to authenticated
using (user_id = (select auth.uid()));

create table public.product_sales (
    product_slug text primary key check (product_slug ~ '^[a-z0-9_]{1,64}$'),
    units_sold integer not null default 0 check (units_sold >= 0),
    updated_at timestamptz not null default now()
);

comment on table public.product_sales is 'Units sold per product slug. Live stock is the Markdown stock minus this number.';

alter table public.product_sales enable row level security;

revoke all on table public.product_sales from anon, authenticated, service_role;
grant select on table public.product_sales to anon, authenticated;

create policy product_sales_select_all on public.product_sales
for select to anon, authenticated
using (true);

create function private.settle_order(p_order_id bigint, p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_debit integer := 0;
    v_order public.orders;
    v_titles text[];
begin
    select o.* into v_order from public.orders o where o.id = p_order_id for update;

    if not found then
        return 'missing';
    end if;

    if v_order.status in ('paid', 'refunded') then
        return v_order.status;
    end if;

    if v_order.prods_applied > 0 then
        select p.prods into v_balance from public.profiles p where p.id = v_order.user_id for update;

        v_debit := least(v_order.prods_applied, coalesce(v_balance, 0));

        if v_debit < v_order.prods_applied and v_order.status = 'canceled' then
            return 'canceled';
        end if;
    end if;

    insert into public.product_sales as s (product_slug, units_sold)
    select i.product_slug, sum(i.quantity)::integer
    from jsonb_to_recordset(v_order.items) as i (product_slug text, quantity integer)
    group by i.product_slug
    order by i.product_slug
    on conflict (product_slug) do update
    set units_sold = s.units_sold + excluded.units_sold, updated_at = now();

    if v_debit > 0 then
        select array_agg(distinct i.title) into v_titles
        from jsonb_to_recordset(v_order.items) as i (title text);

        perform private.add_prods(
            v_order.user_id,
            -v_debit,
            left('Redeemed ' || chr(183) || ' ' || case when cardinality(v_titles) = 1 then v_titles[1] else 'Order ' || v_order.number end, 120)
        );
    end if;

    update public.orders o
    set paid_at = now(),
        prods_debited = v_debit,
        status = 'paid',
        stripe_payment_intent_id = coalesce(p_payment_intent, o.stripe_payment_intent_id)
    where o.id = p_order_id;

    return 'paid';
end;
$$;

revoke execute on function private.settle_order(bigint, text) from public;
grant execute on function private.settle_order(bigint, text) to service_role;

create function private.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_line record;
    v_order public.orders;
    v_reserved integer;
    v_sold integer;
    v_superseded text[];
begin
    perform 1
    from public.orders o
    where o.user_id = p_user_id and o.status = 'pending'
    order by o.id
    for update;

    if p_prods > 0 then
        select p.prods into v_balance from public.profiles p where p.id = p_user_id for update;

        if v_balance is null or v_balance < p_prods then
            raise exception 'prods_negative';
        end if;
    end if;

    with canceled as (
        update public.orders o
        set status = 'canceled'
        where o.user_id = p_user_id and o.status = 'pending'
        returning o.stripe_payment_intent_id
    )
    select coalesce(array_agg(c.stripe_payment_intent_id) filter (where c.stripe_payment_intent_id is not null), '{}')
    into v_superseded
    from canceled c;

    for v_line in
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(p_items) as i (product_slug text, quantity integer)
        group by i.product_slug
        order by i.product_slug
    loop
        insert into public.product_sales (product_slug)
        values (v_line.product_slug)
        on conflict (product_slug) do nothing;

        select s.units_sold into v_sold from public.product_sales s where s.product_slug = v_line.product_slug for update;

        select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
        from public.orders o
        cross join jsonb_array_elements(o.items) as i
        where o.status = 'pending'
            and o.placed_at > now() - interval '10 minutes'
            and o.email <> p_email
            and i ->> 'product_slug' = v_line.product_slug;

        if v_sold + v_reserved + v_line.quantity > coalesce((p_stock ->> v_line.product_slug)::integer, 0) then
            raise exception 'order_conflict';
        end if;
    end loop;

    insert into public.orders (email, items, prods_applied, prods_cents, promo_cents, promo_code, shipping, subtotal_cents, tax_cents, total_cents, user_id)
    values (p_email, p_items, p_prods, p_prods_cents, p_promo_cents, nullif(p_promo_code, ''), p_shipping, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id)
    returning * into v_order;

    if p_total_cents = 0 then
        perform private.settle_order(v_order.id, null);
    end if;

    return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', to_jsonb(v_superseded));
end;
$$;

revoke execute on function private.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid) from public;
grant execute on function private.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

create function private.refund_order(p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_order public.orders;
begin
    select o.* into v_order from public.orders o where o.stripe_payment_intent_id = p_payment_intent for update;

    if not found then
        return 'missing';
    end if;

    if v_order.status <> 'paid' then
        return v_order.status;
    end if;

    if v_order.prods_debited > 0 and v_order.user_id is not null then
        perform private.add_prods(v_order.user_id, v_order.prods_debited, 'Refunded ' || chr(183) || ' Order ' || v_order.number);
    end if;

    perform 1
    from public.product_sales s
    where s.product_slug in (select i.product_slug from jsonb_to_recordset(v_order.items) as i (product_slug text))
    order by s.product_slug
    for update;

    update public.product_sales as s
    set units_sold = greatest(0, s.units_sold - r.quantity), updated_at = now()
    from (
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(v_order.items) as i (product_slug text, quantity integer)
        group by i.product_slug
    ) as r
    where s.product_slug = r.product_slug;

    update public.orders o set status = 'refunded' where o.id = v_order.id;

    return 'refunded';
end;
$$;

revoke execute on function private.refund_order(text) from public;
grant execute on function private.refund_order(text) to service_role;

create function public.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.place_order(p_email, p_items, p_prods, p_prods_cents, p_promo_cents, p_promo_code, p_shipping, p_stock, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id);
$$;

revoke execute on function public.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

create function public.settle_order(p_order_id bigint, p_payment_intent text)
returns text
language sql
security invoker
set search_path = ''
as $$
    select private.settle_order(p_order_id, p_payment_intent);
$$;

revoke execute on function public.settle_order(bigint, text) from public, anon, authenticated;
grant execute on function public.settle_order(bigint, text) to service_role;

create function public.refund_order(p_payment_intent text)
returns text
language sql
security invoker
set search_path = ''
as $$
    select private.refund_order(p_payment_intent);
$$;

revoke execute on function public.refund_order(text) from public, anon, authenticated;
grant execute on function public.refund_order(text) to service_role;

create table public.site_chunks (
    id bigint generated always as identity primary key,
    content_hash text not null,
    url text not null,
    title text not null,
    heading text not null default '',
    content text not null,
    embedding extensions.vector(384) not null,
    created_at timestamptz not null default now(),
    constraint site_chunks_content_hash_key unique (content_hash),
    constraint site_chunks_content_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
    constraint site_chunks_url_check check (url like '/%' and url not like '//%' and char_length(url) <= 300),
    constraint site_chunks_title_check check (char_length(title) between 1 and 120),
    constraint site_chunks_heading_check check (char_length(heading) <= 300),
    constraint site_chunks_content_check check (char_length(content) between 1 and 8000)
);

comment on table public.site_chunks is 'The assistant index: one row per chunk of a public page with its gte-small embedding. Written by the admin through POST /api/ingest; visitors reach it only through match_site_chunks.';

create index site_chunks_embedding_idx on public.site_chunks using hnsw (embedding extensions.vector_ip_ops);

alter table public.site_chunks enable row level security;

revoke all on table public.site_chunks from anon, authenticated, service_role;
grant select, insert, delete on table public.site_chunks to authenticated;

create policy site_chunks_select_admin on public.site_chunks
for select to authenticated
using ((select private.is_admin()));

create policy site_chunks_insert_admin on public.site_chunks
for insert to authenticated
with check ((select private.is_admin()));

create policy site_chunks_delete_admin on public.site_chunks
for delete to authenticated
using ((select private.is_admin()));

create function private.match_site_chunks(p_embedding extensions.vector(384), p_threshold double precision, p_count integer)
returns table (url text, title text, heading text, content text, similarity double precision)
language sql
stable
security definer
set search_path = ''
as $$
    select
        c.url,
        c.title,
        c.heading,
        c.content,
        -(c.embedding operator(extensions.<#>) p_embedding) as similarity
    from public.site_chunks c
    where c.embedding operator(extensions.<#>) p_embedding < -p_threshold
    order by c.embedding operator(extensions.<#>) p_embedding
    limit least(greatest(p_count, 1), 12);
$$;

revoke execute on function private.match_site_chunks(extensions.vector, double precision, integer) from public;
grant execute on function private.match_site_chunks(extensions.vector, double precision, integer) to anon, authenticated, service_role;

create function public.match_site_chunks(p_embedding extensions.vector(384), p_threshold double precision, p_count integer)
returns table (url text, title text, heading text, content text, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
    select m.url, m.title, m.heading, m.content, m.similarity
    from private.match_site_chunks(p_embedding, p_threshold, p_count) m;
$$;

revoke execute on function public.match_site_chunks(extensions.vector, double precision, integer) from public;
grant execute on function public.match_site_chunks(extensions.vector, double precision, integer) to anon, authenticated, service_role;

alter table public.profiles add column welcomed_at timestamptz;

create function private.claim_welcome()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles p
    set welcomed_at = now()
    where p.id = (select auth.uid())
        and p.welcomed_at is null
        and exists (select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null);

    return found;
end;
$$;

revoke execute on function private.claim_welcome() from public;
grant execute on function private.claim_welcome() to authenticated;

create function public.claim_welcome()
returns boolean
language sql
security invoker
set search_path = ''
as $$
    select private.claim_welcome();
$$;

revoke execute on function public.claim_welcome() from public, anon;
grant execute on function public.claim_welcome() to authenticated;

alter table public.profiles
    drop constraint profiles_check,
    drop constraint profiles_check1,
    add constraint profiles_check check (avatar_path = '' or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|webp)$')),
    add constraint profiles_check1 check (track_path = '' or track_path ~ ('^' || id::text || '/spotlight/[0-9a-f-]{36}\.(mp3|wav)$'));

create or replace function private.check_in(p_code text, p_email text, p_newsletter boolean)
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

create or replace function private.prepare_chat_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended('chat:' || new.user_id::text, 0));

    if (
        select count(*)
        from public.chat_messages m
        where m.user_id = new.user_id and m.created_at > now() - interval '10 seconds'
    ) >= 5 then
        raise exception 'chat_rate_limited';
    end if;

    if (
        select count(*)
        from public.chat_messages m
        where m.user_id = new.user_id and m.created_at > now() - interval '24 hours'
    ) >= 300 then
        raise exception 'chat_rate_limited';
    end if;

    new.author_name := coalesce(
        (select left(nullif(btrim(p.artist_name), ''), 50) from public.profiles p where p.id = new.user_id),
        'Member'
    );
    new.created_at := now();

    return new;
end;
$$;

alter table public.orders add column request_id uuid unique;

create or replace function private.settle_order(p_order_id bigint, p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_debit integer := 0;
    v_held integer;
    v_order public.orders;
    v_titles text[];
begin
    select o.* into v_order from public.orders o where o.id = p_order_id for update;

    if not found then
        return 'missing';
    end if;

    if v_order.status in ('paid', 'refunded') then
        return v_order.status;
    end if;

    if v_order.prods_applied > 0 then
        select p.prods into v_balance from public.profiles p where p.id = v_order.user_id for update;

        v_debit := least(v_order.prods_applied, coalesce(v_balance, 0));

        if v_order.status = 'canceled' then
            select coalesce(sum(o.prods_applied), 0)::integer into v_held
            from public.orders o
            where o.user_id = v_order.user_id and o.status = 'pending';

            if coalesce(v_balance, 0) - v_held < v_order.prods_applied then
                return 'canceled';
            end if;
        end if;
    end if;

    insert into public.product_sales as s (product_slug, units_sold)
    select i.product_slug, sum(i.quantity)::integer
    from jsonb_to_recordset(v_order.items) as i (product_slug text, quantity integer)
    group by i.product_slug
    order by i.product_slug
    on conflict (product_slug) do update
    set units_sold = s.units_sold + excluded.units_sold, updated_at = now();

    if v_debit > 0 then
        select array_agg(distinct i.title) into v_titles
        from jsonb_to_recordset(v_order.items) as i (title text);

        perform private.add_prods(
            v_order.user_id,
            -v_debit,
            left('Redeemed ' || chr(183) || ' ' || case when cardinality(v_titles) = 1 then v_titles[1] else 'Order ' || v_order.number end, 120)
        );
    end if;

    update public.orders o
    set paid_at = now(),
        prods_debited = v_debit,
        status = 'paid',
        stripe_payment_intent_id = coalesce(p_payment_intent, o.stripe_payment_intent_id)
    where o.id = p_order_id;

    return 'paid';
end;
$$;

drop function public.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid);
drop function private.place_order(text, jsonb, integer, integer, integer, text, jsonb, jsonb, integer, integer, integer, uuid);

create function private.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_request_id uuid,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_line record;
    v_order public.orders;
    v_reserved integer;
    v_sold integer;
    v_superseded text[];
begin
    perform 1
    from public.orders o
    where o.user_id = p_user_id and o.status = 'pending'
    order by o.id
    for update;

    if p_prods > 0 then
        select p.prods into v_balance from public.profiles p where p.id = p_user_id for update;
    end if;

    if p_request_id is not null then
        select o.* into v_order from public.orders o where o.request_id = p_request_id and o.user_id = p_user_id;

        if found then
            return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', '[]'::jsonb);
        end if;
    end if;

    if p_prods > 0 and (v_balance is null or v_balance < p_prods) then
        raise exception 'prods_negative';
    end if;

    with canceled as (
        update public.orders o
        set status = 'canceled'
        where o.user_id = p_user_id and o.status = 'pending'
        returning o.stripe_payment_intent_id
    )
    select coalesce(array_agg(c.stripe_payment_intent_id) filter (where c.stripe_payment_intent_id is not null), '{}')
    into v_superseded
    from canceled c;

    for v_line in
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(p_items) as i (product_slug text, quantity integer)
        group by i.product_slug
        order by i.product_slug
    loop
        insert into public.product_sales (product_slug)
        values (v_line.product_slug)
        on conflict (product_slug) do nothing;

        select s.units_sold into v_sold from public.product_sales s where s.product_slug = v_line.product_slug for update;

        select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
        from public.orders o
        cross join jsonb_array_elements(o.items) as i
        where o.status = 'pending'
            and o.placed_at > now() - interval '10 minutes'
            and o.email <> p_email
            and i ->> 'product_slug' = v_line.product_slug;

        if v_sold + v_reserved + v_line.quantity > coalesce((p_stock ->> v_line.product_slug)::integer, 0) then
            raise exception 'order_conflict';
        end if;
    end loop;

    insert into public.orders (email, items, prods_applied, prods_cents, promo_cents, promo_code, request_id, shipping, subtotal_cents, tax_cents, total_cents, user_id)
    values (p_email, p_items, p_prods, p_prods_cents, p_promo_cents, nullif(p_promo_code, ''), p_request_id, p_shipping, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id)
    returning * into v_order;

    if p_total_cents = 0 then
        perform private.settle_order(v_order.id, null);
    end if;

    return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', to_jsonb(v_superseded));
end;
$$;

revoke execute on function private.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) from public;
grant execute on function private.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

create function public.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_request_id uuid,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.place_order(p_email, p_items, p_prods, p_prods_cents, p_promo_cents, p_promo_code, p_request_id, p_shipping, p_stock, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id);
$$;

revoke execute on function public.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

alter table public.profiles
    add column featured boolean not null default false,
    add column member_number integer generated by default as identity unique,
    add column track_seconds integer not null default 0 check (track_seconds between 0 and 86400);

comment on table public.profiles is 'One row per account: everything settings and onboarding edit, plus the Prods balance kept in step with prods_entries. Readable by its owner and the admin; get_roster publishes the card of every onboarded member.';

create index profiles_track_path_idx on public.profiles (track_path) where track_path <> '';

grant update (track_seconds) on table public.profiles to authenticated;

create function private.get_roster()
returns table (
    member_number integer,
    artist_name text,
    avatar_path text,
    bio text,
    city text,
    state text,
    genres text[],
    role text,
    instagram_url text,
    soundcloud_url text,
    spotify_url text,
    youtube_url text,
    track_name text,
    track_path text,
    track_seconds integer,
    featured boolean,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        p.member_number,
        p.artist_name,
        p.avatar_path,
        p.bio,
        p.city,
        p.state,
        p.genres,
        p.role,
        p.instagram_url,
        p.soundcloud_url,
        p.spotify_url,
        p.youtube_url,
        p.track_name,
        p.track_path,
        p.track_seconds,
        p.featured,
        p.created_at
    from public.profiles p
    where p.onboarded
    order by p.member_number
    limit 500;
$$;

revoke execute on function private.get_roster() from public;
grant execute on function private.get_roster() to anon, authenticated, service_role;

create function public.get_roster()
returns table (
    member_number integer,
    artist_name text,
    avatar_path text,
    bio text,
    city text,
    state text,
    genres text[],
    role text,
    instagram_url text,
    soundcloud_url text,
    spotify_url text,
    youtube_url text,
    track_name text,
    track_path text,
    track_seconds integer,
    featured boolean,
    created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        r.member_number,
        r.artist_name,
        r.avatar_path,
        r.bio,
        r.city,
        r.state,
        r.genres,
        r.role,
        r.instagram_url,
        r.soundcloud_url,
        r.spotify_url,
        r.youtube_url,
        r.track_name,
        r.track_path,
        r.track_seconds,
        r.featured,
        r.created_at
    from private.get_roster() r
    order by r.member_number;
$$;

revoke execute on function public.get_roster() from public;
grant execute on function public.get_roster() to anon, authenticated, service_role;

create function private.is_spotlight(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles p
        where p.onboarded and p.track_path <> '' and p.track_path = p_name
    );
$$;

revoke execute on function private.is_spotlight(text) from public;
grant execute on function private.is_spotlight(text) to anon, authenticated;

create policy objects_select_spotlight on storage.objects
for select to anon, authenticated
using (bucket_id = 'tracks' and private.is_spotlight(name));

create or replace function private.enforce_object_caps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cap integer;
    v_folders text[] := storage.foldername(new.name);
    v_prefix text;
begin
    if (select auth.role()) = 'anon' then
        return new;
    end if;

    if v_folders[1] is null then
        return new;
    end if;

    if new.bucket_id = 'avatars' then
        v_cap := 2;
        v_prefix := v_folders[1] || '/';
    elsif v_folders[2] = 'spotlight' then
        v_cap := 3;
        v_prefix := v_folders[1] || '/spotlight/';
    else
        if not exists (
            select 1
            from unnest(array['assembly', 'bash']) as b (board)
            where public.current_event_id(b.board) = v_folders[2]
                and private.is_switch_open(b.board || '_intake')
        ) then
            raise exception 'intake_closed';
        end if;

        v_cap := 4;
        v_prefix := v_folders[1] || '/' || v_folders[2] || '/';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(new.bucket_id || '/' || v_prefix, 0));

    if (
        select count(*)
        from storage.objects o
        where o.bucket_id = new.bucket_id and starts_with(o.name, v_prefix) and o.name <> new.name
    ) >= v_cap then
        raise exception 'object_limit';
    end if;

    return new;
end;
$$;

create table public.promo_codes (
    code text primary key check (code ~ '^[0-9A-Z]{1,20}$'),
    discount_basis_points integer not null check (discount_basis_points between 1 and 10000),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

comment on table public.promo_codes is 'Store discount codes in upper case with the share of the subtotal each takes off, in basis points. Rows are added by hand in SQL so that no code sits in the repository. No API role can read the table; the order routes ask get_promo_code as service_role.';

alter table public.promo_codes enable row level security;

revoke all on table public.promo_codes from anon, authenticated, service_role;

create view public.promo_code_usage
with (security_invoker = true)
as
select
    o.promo_code as code,
    count(*) filter (where o.status = 'paid') as paid_orders,
    count(*) filter (where o.status = 'refunded') as refunded_orders,
    coalesce(sum(o.promo_cents) filter (where o.status = 'paid'), 0) as paid_discount_cents
from public.orders o
where o.promo_code is not null and o.status in ('paid', 'refunded')
group by o.promo_code;

comment on view public.promo_code_usage is 'Uses per discount code, counted from orders. A use is a paid order; a refunded order leaves that count and is listed beside it; pending and canceled orders never count. No API role can read it, so it is seen in the dashboard only.';

revoke all on table public.promo_code_usage from anon, authenticated, service_role;

create function private.get_promo_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object('code', c.code, 'discount_basis_points', c.discount_basis_points)
    from public.promo_codes c
    where c.code = upper(btrim(coalesce(p_code, ''))) and c.is_active;
$$;

revoke execute on function private.get_promo_code(text) from public;
grant execute on function private.get_promo_code(text) to service_role;

create function public.get_promo_code(p_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select private.get_promo_code(p_code);
$$;

revoke execute on function public.get_promo_code(text) from public, anon, authenticated;
grant execute on function public.get_promo_code(text) to service_role;

create or replace function private.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_request_id uuid,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_line record;
    v_order public.orders;
    v_reserved integer;
    v_sold integer;
    v_superseded text[];
begin
    perform 1
    from public.orders o
    where o.status = 'pending'
        and (o.user_id = p_user_id or (p_user_id is null and o.user_id is null and lower(o.email) = lower(p_email)))
    order by o.id
    for update;

    if p_prods > 0 then
        select p.prods into v_balance from public.profiles p where p.id = p_user_id for update;
    end if;

    if p_request_id is not null then
        select o.* into v_order from public.orders o where o.request_id = p_request_id and o.user_id = p_user_id;

        if found then
            return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', '[]'::jsonb);
        end if;
    end if;

    if p_prods > 0 and (v_balance is null or v_balance < p_prods) then
        raise exception 'prods_negative';
    end if;

    with canceled as (
        update public.orders o
        set status = 'canceled'
        where o.status = 'pending'
            and (o.user_id = p_user_id or (p_user_id is null and o.user_id is null and lower(o.email) = lower(p_email)))
        returning o.stripe_payment_intent_id
    )
    select coalesce(array_agg(c.stripe_payment_intent_id) filter (where c.stripe_payment_intent_id is not null), '{}')
    into v_superseded
    from canceled c;

    for v_line in
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(p_items) as i (product_slug text, quantity integer)
        group by i.product_slug
        order by i.product_slug
    loop
        insert into public.product_sales (product_slug)
        values (v_line.product_slug)
        on conflict (product_slug) do nothing;

        select s.units_sold into v_sold from public.product_sales s where s.product_slug = v_line.product_slug for update;

        select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
        from public.orders o
        cross join jsonb_array_elements(o.items) as i
        where o.status = 'pending'
            and o.placed_at > now() - interval '10 minutes'
            and i ->> 'product_slug' = v_line.product_slug;

        if v_sold + v_reserved + v_line.quantity > coalesce((p_stock ->> v_line.product_slug)::integer, 0) then
            raise exception 'order_conflict';
        end if;
    end loop;

    insert into public.orders (email, items, prods_applied, prods_cents, promo_cents, promo_code, request_id, shipping, subtotal_cents, tax_cents, total_cents, user_id)
    values (p_email, p_items, p_prods, p_prods_cents, p_promo_cents, nullif(p_promo_code, ''), p_request_id, p_shipping, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id)
    returning * into v_order;

    if p_total_cents = 0 then
        perform private.settle_order(v_order.id, null);
    end if;

    return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', to_jsonb(v_superseded));
end;
$$;

revoke execute on function public.subscribe_newsletter(text) from anon;
revoke execute on function private.subscribe_newsletter(text) from anon;

grant select, insert, delete on table public.site_chunks to service_role;

comment on table public.site_chunks is 'The assistant index: one row per chunk of a public page with its gte-small embedding. Written through POST /api/ingest, by the admin on demand and by the server after each production deploy; visitors reach it only through match_site_chunks.';
