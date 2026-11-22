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
