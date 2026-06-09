import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const CONTENT_PATH = 'src/content';
const EVENT_TYPES = ['cookup', 'mixer', 'panel', 'showcase', 'workshop'] as const;
const PRODUCT_CATEGORIES = ['accessory', 'apparel', 'print'] as const;
const PRODUCT_KINDS = ['photo-pack', 'press-kit', 'sample-pack', 'stems', 'video'] as const;

const bash = defineCollection({
    loader: glob({ base: `./${CONTENT_PATH}/bash`, pattern: '**/*.md' }),
    schema: z.object({
        assets: z.array(z.object({
            href: z.string(),
            kind: z.enum(PRODUCT_KINDS),
            label: z.string(),
            size: z.string(),
        })).default([]),
        cover: z.string().optional(),
        date: z.coerce.date(),
        edition: z.string(),
        recap: z.string(),
        title: z.string(),
    }),
});

const events = defineCollection({
    loader: glob({ base: `./${CONTENT_PATH}/events`, pattern: '**/*.md' }),
    schema: z.object({
        cover: z.string().optional(),
        date: z.coerce.date(),
        excerpt: z.string(),
        location: z.string(),
        rsvp: z.string().url().optional(),
        status: z.enum(['past', 'upcoming']).default('upcoming'),
        title: z.string(),
        type: z.enum(EVENT_TYPES),
    }),
});

const producers = defineCollection({
    loader: glob({ base: `./${CONTENT_PATH}/producers`, pattern: '**/*.md' }),
    schema: z.object({
        avatar: z.string().optional(),
        bio: z.string(),
        genres: z.array(z.string()),
        handle: z.string(),
        links: z.object({
            bandcamp: z.string().url().optional(),
            instagram: z.string().url().optional(),
            site: z.string().url().optional(),
            soundcloud: z.string().url().optional(),
            spotify: z.string().url().optional(),
        }).default({}),
        location: z.string().default('Austin, TX'),
        name: z.string(),
    }),
});

const products = defineCollection({
    loader: glob({ base: `./${CONTENT_PATH}/products`, pattern: '**/*.md' }),
    schema: z.object({
        category: z.enum(PRODUCT_CATEGORIES),
        colors: z.array(z.object({
            hex: z.string(),
            name: z.string(),
        })).default([]),
        description: z.string(),
        details: z.array(z.string()).default([]),
        images: z.array(z.string()).min(1),
        inStock: z.boolean().default(true),
        priceCents: z.number().int().positive(),
        sizes: z.array(z.string()).default([]),
        slug: z.string(),
        title: z.string(),
    }),
});

export const collections = { bash, events, producers, products };
