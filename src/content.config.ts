import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { ASSET_KINDS, EVENT_TYPES, GENRES, MEMBER_ROLES, PRODUCT_CATEGORIES, PRODUCT_SIZES } from '@lib/shared/constants';

const CONTENT_DIRECTORY = 'src/content';
const PRODUCER_ID_PATTERN = /^\d{6}$/;
const SKU_FIRST_VARIATION = '0';
const SKU_GENERATION = '0';
const SKU_PATTERN = /^\d{5}$/;
const VARIATION_LIMIT = 10;

const bash = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/bash`, pattern: '**/*.md' }),
    schema: z.object({
        date: z.coerce.date(),
        edition: z.string(),
        end: z.coerce.date(),
        location: z.string(),
        prompt: z.string(),
        recap: z.string(),
        room: z.string().optional(),
        sponsors: z.array(z.object({
            description: z.string().optional(),
            name: z.string(),
        })).default([]),
        title: z.string(),
        winners: z.array(z.object({
            name: z.string(),
            place: z.string(),
        })).default([]),
    }),
});

const docs = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/docs`, pattern: '**/*.md' }),
    schema: z.object({
        description: z.string(),
        title: z.string(),
        updated: z.coerce.date(),
    }),
});

const downloads = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/downloads`, pattern: '**/*.md' }),
    schema: z.object({
        available: z.boolean().default(false),
        date: z.coerce.date(),
        description: z.string(),
        doc: reference('docs').optional(),
        format: z.string(),
        href: z.string().optional(),
        kind: z.enum(ASSET_KINDS),
        size: z.string(),
        title: z.string(),
        unlocksAt: z.coerce.date().optional(),
    }),
});

const events = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/events`, pattern: '**/*.md' }),
    schema: z.object({
        date: z.coerce.date(),
        description: z.string().optional(),
        end: z.coerce.date(),
        excerpt: z.string(),
        location: z.string(),
        room: z.string().optional(),
        rsvp: z.url().optional(),
        speaker: z.string().optional(),
        speakers: z.array(z.object({
            bio: z.string().optional(),
            credits: z.string().optional(),
            name: z.string(),
            realName: z.string().optional(),
            website: z.url().optional(),
        })).default([]),
        title: z.string(),
        type: z.enum(EVENT_TYPES),
        workshop: z.string().optional(),
    }),
});

const producers = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/producers`, pattern: '**/*.md' }),
    schema: z.object({
        bio: z.string(),
        featured: z.boolean().default(false),
        genres: z.array(z.enum(GENRES)).default([]).transform(sortGenres),
        joined: z.coerce.date(),
        links: z.array(z.object({
            href: z.string(),
            label: z.string(),
        })).default([]),
        location: z.string().default('Austin, TX'),
        name: z.string(),
        producerId: z.string().regex(PRODUCER_ID_PATTERN),
        roles: z.array(z.enum(MEMBER_ROLES)).length(1),
        tracks: z.array(z.object({
            durationSeconds: z.number().int().positive(),
            file: z.string().optional(),
            title: z.string(),
        })).max(1).default([]),
    }),
});

const products = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/products`, pattern: '**/*.md' }),
    schema: z.object({
        base: z.string(),
        category: z.enum(PRODUCT_CATEGORIES),
        description: z.string(),
        details: z.array(z.string()).default([]),
        priceCents: z.number().int().positive(),
        sizes: z.array(z.enum(PRODUCT_SIZES)).default([]),
        sku: z.string().regex(SKU_PATTERN),
        stock: z.number().int().nonnegative().default(0),
        title: z.string(),
        variations: z.array(z.object({
            hex: z.string(),
            name: z.string(),
            priceCents: z.number().int().positive().optional(),
            sku: z.string().regex(SKU_PATTERN),
        })).min(1).max(VARIATION_LIMIT),
    })
        .refine(data => data.variations.some(variation => variation.name === data.base), { message: 'Base must name one of the variations.' })
        .refine(
            data => data.variations.every((variation, index) => index === 0 || data.variations[index - 1].name.localeCompare(variation.name) < 0),
            { message: 'Variations must be listed in alphabetical order by name.' },
        )
        .refine(
            data => data.variations.every((variation, index) => variation.sku === `${data.sku.slice(0, -1)}${index}`),
            { message: 'Variation SKUs must share the product SKU apart from the last digit, which counts up from 0 in list order.' },
        )
        .refine(
            data => data.sku.endsWith(SKU_FIRST_VARIATION) && data.sku.startsWith(`${SKU_GENERATION}${PRODUCT_CATEGORIES.indexOf(data.category)}`),
            { message: 'SKU must start with the generation digit and the category index and end in the first variation digit.' },
        ),
});

function sortGenres(genres: (typeof GENRES)[number][]): (typeof GENRES)[number][] {
    return [...genres].sort((a, b) => GENRES.indexOf(a) - GENRES.indexOf(b));
}

export const collections = { bash, docs, downloads, events, producers, products };
