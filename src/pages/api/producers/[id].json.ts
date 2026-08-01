import { getCollection } from 'astro:content';

import { toProducerRecord } from '@lib/utils';

import type { APIRoute } from 'astro';

export const prerender = true;

export async function getStaticPaths() {
    const producers = await getCollection('producers');

    return producers.map(producer => ({ params: { id: producer.id } }));
}

export const GET: APIRoute = async ({ params }) => {
    const producers = await getCollection('producers');
    const producer = producers.find(entry => entry.id === params.id);

    if (!producer) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ producer: toProducerRecord(producer) });
};
