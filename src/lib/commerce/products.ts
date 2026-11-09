import { getImage } from 'astro:assets';

import type { CollectionEntry } from 'astro:content';

type Product = CollectionEntry<'products'>['data'];
type Variation = Product['variations'][number];

const IMAGE_EXTENSION = '.webp';
const ROW_IMAGE_WIDTH = 320;
const STORE_IMAGES = import.meta.glob<{ default: ImageMetadata }>('/src/images/store/*.webp', { eager: true });

function getBaseVariation(product: Product): Variation {
    return product.variations.find(variation => variation.name === product.base) ?? product.variations[0];
}

function getVariationImage(variation: Variation): ImageMetadata | undefined {
    return STORE_IMAGES[`/src/images/store/${toImageKey(variation)}.webp`]?.default;
}

function getVariationPrice(product: Product, variation: Variation): number {
    return variation.priceCents ?? product.priceCents;
}

function toCatalog(products: CollectionEntry<'products'>[]): CatalogEntry[] {
    return products.map(product => ({
        priceCents: product.data.priceCents,
        sku: product.data.sku,
        slug: product.id,
        stock: product.data.stock,
        title: product.data.title,
        variations: product.data.variations.map(variation => ({
            image: toImageKey(variation),
            name: variation.name,
            priceCents: getVariationPrice(product.data, variation),
            sku: variation.sku,
        })),
    }));
}

function toImageKey(variation: Pick<Variation, 'name' | 'sku'>): string {
    return `${variation.sku}_${variation.name.toLowerCase().replace(/[^a-z\d]+/g, '_')}`;
}

async function toImageSources(): Promise<ImageSources> {
    const sources = await Promise.all(Object.entries(STORE_IMAGES).map(async ([path, asset]) => {
        const rendered = await getImage({ src: asset.default, width: ROW_IMAGE_WIDTH });

        return [path.slice(path.lastIndexOf('/') + 1, -IMAGE_EXTENSION.length), rendered.src] as const;
    }));

    return Object.fromEntries(sources);
}

export { getBaseVariation, getVariationImage, getVariationPrice, toCatalog, toImageKey, toImageSources };
