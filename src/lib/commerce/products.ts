import { getImage } from 'astro:assets';

import type { CollectionEntry } from 'astro:content';

const IMAGE_EXTENSION = '.webp';
const ROW_IMAGE_WIDTH = 320;
const STORE_IMAGES = import.meta.glob<{ default: ImageMetadata }>('/src/images/store/*.webp', { eager: true });

function getVariationImage(sku: number, variation: string): ImageMetadata | undefined {
    return STORE_IMAGES[`/src/images/store/${sku}_${toVariationSlug(variation)}.webp`]?.default;
}

function toImageKey(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1, -IMAGE_EXTENSION.length);
}

async function toImageSources(): Promise<ImageSources> {
    const sources = await Promise.all(Object.entries(STORE_IMAGES).map(async ([path, asset]) => {
        const rendered = await getImage({ src: asset.default, width: ROW_IMAGE_WIDTH });

        return [toImageKey(path), rendered.src] as const;
    }));

    return Object.fromEntries(sources);
}

function toVariationSlug(variation: string): string {
    return variation.toLowerCase().replace(/[^a-z\d]+/g, '_');
}

function toVariations(product: CollectionEntry<'products'>['data']): string[] {
    return product.variations.map(variation => variation.name).toSorted((a, b) => a.localeCompare(b));
}

export { getVariationImage, toImageSources, toVariationSlug, toVariations };
