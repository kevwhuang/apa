import { getCollection } from 'astro:content';

import { createServerClient } from '@lib/server/supabase';
import { getVariationPrice } from '@lib/commerce/products';
import { limitRequest } from '@lib/server/limiter';

import type { APIRoute } from 'astro';

interface SalesRow {
    product_slug: string;
    units_sold: number;
}

async function loadSales(slugs: string[]) {
    const { data } = await createServerClient().from('product_sales').select('product_slug, units_sold').in('product_slug', slugs);

    const rows: SalesRow[] = data ?? [];

    return new Map(rows.map(row => [row.product_slug, row.units_sold]));
}

export const prerender = false;

export const GET: APIRoute = async ({ clientAddress }) => {
    const limited = await limitRequest('content', clientAddress);

    if (limited) return limited;

    const products = await getCollection('products');

    const sold = await loadSales(products.map(entry => entry.id));

    const records = products
        .map(entry => ({
            ...entry.data,
            id: entry.id,
            stock: Math.max(0, entry.data.stock - (sold.get(entry.id) ?? 0)),
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
