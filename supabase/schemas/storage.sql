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
