import { getCollection } from 'astro:content';

import { toAustinIso } from '@lib/shared/utils';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const downloads = await getCollection('downloads');

    const records = downloads
        .sort((a, b) => +b.data.date - +a.data.date)
        .map(entry => ({
            ...entry.data,
            date: toAustinIso(entry.data.date),
            doc: entry.data.doc?.id,
            id: entry.id,
            unlocksAt: entry.data.unlocksAt ? toAustinIso(entry.data.unlocksAt) : undefined,
        }));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
