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
