import { getCollection } from 'astro:content';

import { toProducerRecord } from '@lib/shared/utils';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const producers = await getCollection('producers');

    const records = producers.map(toProducerRecord).sort((a, b) => a.id.localeCompare(b.id));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
