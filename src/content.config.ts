import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { ASSET_KINDS, PRODUCT_CATEGORIES, PRODUCT_SIZES } from '@lib/shared/constants';

const CONTENT_DIRECTORY = 'src/content';
const EVENT_PROGRAMS = ['Assembly', 'Bash', 'Hangout'] as const;
const EVENT_TITLE_MAX_LENGTH = 90;
const SKU_FIRST_VARIATION = '0';
const SKU_GENERATION = '0';
const SKU_PATTERN = /^\d{5}$/;
const SPEAKER_NAME_MAX_LENGTH = 70;
const URL_MESSAGE = 'URL must start with https:// and not end with a slash.';
const URL_PATTERN = /^https:\/\/.*[^/]$/;
const VARIATION_LIMIT = 10;

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
    schema: z.strictObject({
        ends_at: z.coerce.date(),
        external_url: z.url().regex(URL_PATTERN, { message: URL_MESSAGE }).optional(),
        program: z.enum(EVENT_PROGRAMS),
        room: z.string().min(1).optional(),
        speaker: reference('speakers').optional(),
        sponsor: reference('sponsors').optional(),
        starts_at: z.coerce.date(),
        title: z.string().min(1).max(EVENT_TITLE_MAX_LENGTH),
        venue: z.string().min(1),
    }).refine(data => data.ends_at.getTime() > data.starts_at.getTime(), { message: 'Event must end after it starts.', path: ['ends_at'] }),
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

const speakers = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/speakers`, pattern: '**/*.md' }),
    schema: z.strictObject({
        name: z.string().min(1).max(SPEAKER_NAME_MAX_LENGTH),
    }),
});

const sponsors = defineCollection({
    loader: glob({ base: `./${CONTENT_DIRECTORY}/sponsors`, pattern: '**/*.md' }),
    schema: z.strictObject({
        name: z.string().min(1),
    }),
});

export const collections = { docs, downloads, events, products, speakers, sponsors };
