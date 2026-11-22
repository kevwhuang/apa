import { HTMLElement, TextNode, parse } from 'node-html-parser';
import { createHash } from 'node:crypto';

import { ROUTES, TITLE_SEPARATOR } from '@lib/shared/constants';
import { embedTexts } from '@lib/server/ai';

import type { Node } from 'node-html-parser';
import type { SupabaseClient } from '@supabase/supabase-js';

type IngestResult = { complete: boolean; embedded: number; ok: true; removed: number; total: number } | { message: string; ok: false };

interface IndexRow {
    content_hash: string;
}

interface SiteChunk {
    content: string;
    hash: string;
    heading: string;
    title: string;
    url: string;
}

const BUDGET_MILLISECONDS = 45_000;
const CHUNK_MAX_WORDS = 300;
const CHUNK_MIN_WORDS = 8;
const CONTAINER_SELECTOR = 'article, section';
const DELETE_BATCH_LIMIT = 50;
const EMBEDDING_MODEL = 'gte-small';
const EMBED_BATCH_LIMIT = 2;
const HEADING_SELECTOR = 'h1, h2, h3';
const HEADING_SEPARATOR = ' \u203a ';
const INDEX_READ_LIMIT = 1_000;

const MESSAGES = {
    embedding: 'The embedding service did not respond. Chunks saved before the failure were kept.',
    page: 'A page could not be read, so nothing was changed.',
    sitemap: 'The sitemap could not be read, so nothing was changed.',
    storage: 'The index could not be read or written.',
} as const;

const NOISE_SELECTOR = 'script, style, template, svg, form, dialog, [aria-hidden="true"], [hidden], .producer-card, [data-producer-strip], section[aria-labelledby="featured-producer-title"]';
const SITEMAP_PATH = '/sitemap-0.xml';

function collectText(node: Node, parts: string[]) {
    if (node instanceof TextNode) {
        if (!node.isWhitespace) parts.push(node.trimmedText);

        return;
    }

    for (const child of node.childNodes) {
        collectText(child, parts);
    }
}

function extractChunks(html: string, path: string) {
    const root = parse(html);

    const main = root.querySelector('main');

    if (!main) return [];

    main.querySelectorAll(NOISE_SELECTOR).forEach(node => node.remove());

    const chunks: SiteChunk[] = [];
    const title = root.querySelector('title')?.text.split(TITLE_SEPARATOR)[0].trim() || path;
    const trails = new Map<HTMLElement, string[]>();

    for (const container of main.querySelectorAll(CONTAINER_SELECTOR)) {
        const own = container.clone();

        if (!(own instanceof HTMLElement)) continue;

        own.querySelectorAll(CONTAINER_SELECTOR).forEach(node => node.remove());

        const heading = own.querySelector(HEADING_SELECTOR);
        const parent = container.parentNode?.closest(CONTAINER_SELECTOR);

        const label = heading ? readText(heading) : '';
        const parentTrail = (parent && trails.get(parent)) ?? [];

        const trail = label ? [...parentTrail, label] : parentTrail;

        trails.set(container, trail);

        const anchor = heading?.id || container.id;

        const url = anchor ? `${path}#${anchor}` : path;

        for (const words of toBatches(readText(own).split(' '), CHUNK_MAX_WORDS)) {
            if (words.length < CHUNK_MIN_WORDS) continue;

            const content = words.join(' ');
            const section = trail.join(HEADING_SEPARATOR);

            const hash = createHash('sha256').update([EMBEDDING_MODEL, url, title, section, content].join('\n')).digest('hex');

            chunks.push({ content, hash, heading: section, title, url });
        }
    }

    return chunks;
}

async function ingestSite(origin: string, supabase: SupabaseClient): Promise<IngestResult> {
    const startedAt = Date.now();

    const paths = await readPaths(origin);

    if (paths.length === 0) return { message: MESSAGES.sitemap, ok: false };

    const pages = await Promise.all(paths.map(path => readPage(origin, path)));

    if (pages.includes(null)) return { message: MESSAGES.page, ok: false };

    const chunks = new Map<string, SiteChunk>();

    for (const chunk of pages.flatMap(page => page ?? [])) {
        chunks.set(chunk.hash, chunk);
    }

    const { data, error } = await supabase.from('site_chunks').select('content_hash').limit(INDEX_READ_LIMIT);

    if (error) return { message: MESSAGES.storage, ok: false };

    const rows: IndexRow[] = data;

    const existing = new Set(rows.map(row => row.content_hash));

    const missing = [...chunks.values()].filter(chunk => !existing.has(chunk.hash));

    let embedded = 0;

    for (const batch of toBatches(missing, EMBED_BATCH_LIMIT)) {
        if (Date.now() - startedAt > BUDGET_MILLISECONDS) break;

        const embeddings = await embedTexts(batch.map(chunk => [chunk.title, chunk.heading, chunk.content].filter(Boolean).join('\n')), supabase);

        if (!embeddings) return { message: MESSAGES.embedding, ok: false };

        const inserts = batch.map((chunk, index) => ({
            content: chunk.content,
            content_hash: chunk.hash,
            embedding: JSON.stringify(embeddings[index]),
            heading: chunk.heading,
            title: chunk.title,
            url: chunk.url,
        }));

        const { error: writeError } = await supabase.from('site_chunks').upsert(inserts, { ignoreDuplicates: true, onConflict: 'content_hash' });

        if (writeError) return { message: MESSAGES.storage, ok: false };

        embedded += batch.length;
    }

    const isComplete = embedded === missing.length;

    const stale = !import.meta.env.DEV && isComplete ? [...existing].filter(hash => !chunks.has(hash)) : [];

    for (const batch of toBatches(stale, DELETE_BATCH_LIMIT)) {
        const { error: pruneError } = await supabase.from('site_chunks').delete().in('content_hash', batch);

        if (pruneError) return { message: MESSAGES.storage, ok: false };
    }

    return { complete: isComplete, embedded, ok: true, removed: stale.length, total: chunks.size };
}

async function readPage(origin: string, path: string) {
    try {
        const response = await fetch(new URL(path, origin));

        return response.ok ? extractChunks(await response.text(), path) : null;
    } catch {
        return null;
    }
}

async function readPaths(origin: string) {
    if (import.meta.env.DEV) return ROUTES.map(route => route.href);

    try {
        const response = await fetch(new URL(SITEMAP_PATH, origin));

        if (!response.ok) return [];

        return parse(await response.text()).querySelectorAll('loc').map(node => new URL(node.text).pathname);
    } catch {
        return [];
    }
}

function readText(node: Node) {
    const parts: string[] = [];

    collectText(node, parts);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function toBatches<T>(items: T[], limit: number) {
    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += limit) {
        batches.push(items.slice(index, index + limit));
    }

    return batches;
}

export { ingestSite };
