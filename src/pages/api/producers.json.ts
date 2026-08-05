import { getCollection } from 'astro:content';

import { toProducerRecord } from '@lib/utils';

import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
    const producers = await getCollection('producers');

    const records = producers.map(toProducerRecord).sort((a, b) => a.id.localeCompare(b.id));

    return Response.json({ count: records.length, producers: records });
};
