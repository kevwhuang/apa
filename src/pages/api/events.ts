import { getCollection } from 'astro:content';

import { toAustinIso } from '@lib/shared/utils';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const editions = await getCollection('bash');
    const events = await getCollection('events');

    const records = [
        ...events.map(entry => ({ ...entry.data, id: entry.id })),
        ...editions.map(entry => ({ ...entry.data, id: entry.id, type: 'bash' })),
    ]
        .sort((a, b) => +a.date - +b.date)
        .map(record => ({ ...record, date: toAustinIso(record.date), end: toAustinIso(record.end) }));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
