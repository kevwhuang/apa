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
