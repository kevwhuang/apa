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
