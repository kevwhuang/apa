import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import {
    ASSET_KINDS,
    CONTENT_DIR,
    EVENT_STATUSES,
    EVENT_TYPES,
    GENRES,
    PRODUCT_CATEGORIES,
} from '@lib/shared/constants';

const bash = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/bash`, pattern: '**/*.md' }),
    schema: z.object({
        date: z.coerce.date(),
        edition: z.string(),
        end: z.coerce.date(),
        location: z.string(),
        prompt: z.string(),
        recap: z.string(),
        status: z.enum(EVENT_STATUSES).default('past'),
        title: z.string(),
    }),
});

const docs = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/docs`, pattern: '**/*.md' }),
    schema: z.object({
        description: z.string(),
        title: z.string(),
        updated: z.coerce.date(),
    }),
});

const downloads = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/downloads`, pattern: '**/*.md' }),
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
    }),
});

const events = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/events`, pattern: '**/*.md' }),
    schema: z.object({
        date: z.coerce.date(),
        end: z.coerce.date(),
        excerpt: z.string(),
        guest: z.string().optional(),
        location: z.string(),
        status: z.enum(EVENT_STATUSES).default('upcoming'),
        title: z.string(),
        type: z.enum(EVENT_TYPES),
    }),
});

const producers = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/producers`, pattern: '**/*.md' }),
    schema: z.object({
        avatar: z.string().optional(),
        bio: z.string(),
        featured: z.boolean().default(false),
        genres: z.array(z.enum(GENRES)).max(5).default([]),
        joined: z.coerce.date(),
        links: z.array(z.object({
            href: z.string(),
            label: z.string(),
        })).default([]),
        location: z.string().default('Austin, TX'),
        name: z.string(),
        roles: z.array(z.string()).default([]),
        tracks: z.array(z.object({
            durationSeconds: z.number().int().positive(),
            title: z.string(),
        })).max(1).default([]),
    }),
});

const products = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/products`, pattern: '**/*.md' }),
    schema: z.object({
        category: z.enum(PRODUCT_CATEGORIES),
        colors: z.array(z.object({
            hex: z.string(),
            name: z.string(),
        })).default([]),
        description: z.string(),
        details: z.array(z.string()).default([]),
        images: z.array(z.string()).min(1),
        priceCents: z.number().int().positive(),
        sizes: z.array(z.string()).default([]),
        stock: z.number().int().nonnegative().default(0),
        title: z.string(),
    }),
});

export const collections = { bash, docs, downloads, events, producers, products };
