import { getCollection } from 'astro:content';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const products = await getCollection('products');

    const records = products
        .map(entry => ({ ...entry.data, id: entry.id }))
        .sort((a, b) => a.id.localeCompare(b.id));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
