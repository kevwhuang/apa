import { getCollection } from 'astro:content';

import { getVariationPrice } from '@lib/commerce/products';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const products = await getCollection('products');

    const records = products
        .map(entry => ({
            ...entry.data,
            id: entry.id,
            variations: entry.data.variations.map(variation => ({
                hex: variation.hex,
                name: variation.name,
                priceCents: getVariationPrice(entry.data, variation),
                sku: variation.sku,
            })),
        }))
        .sort((a, b) => a.sku.localeCompare(b.sku));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
