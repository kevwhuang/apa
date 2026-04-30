import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
    schema: z.object({
        title: z.string(),
        date: z.coerce.date(),
        location: z.string(),
        type: z.enum(['cookup', 'showcase', 'workshop', 'mixer', 'panel']),
        status: z.enum(['upcoming', 'past']).default('upcoming'),
        rsvp: z.string().url().optional(),
        cover: z.string().optional(),
        excerpt: z.string(),
    }),
});

const producers = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/producers' }),
    schema: z.object({
        name: z.string(),
        handle: z.string(),
        genres: z.array(z.string()),
        location: z.string().default('Austin, TX'),
        bio: z.string(),
        links: z.object({
            instagram: z.string().url().optional(),
            soundcloud: z.string().url().optional(),
            spotify: z.string().url().optional(),
            bandcamp: z.string().url().optional(),
            site: z.string().url().optional(),
        }).default({}),
        avatar: z.string().optional(),
    }),
});

const products = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
    schema: z.object({
        title: z.string(),
        slug: z.string(),
        category: z.enum(['apparel', 'accessory', 'print']),
        priceCents: z.number().int().positive(),
        sizes: z.array(z.string()).default([]),
        colors: z.array(z.object({
            name: z.string(),
            hex: z.string(),
        })).default([]),
        images: z.array(z.string()).min(1),
        description: z.string(),
        details: z.array(z.string()).default([]),
        inStock: z.boolean().default(true),
    }),
});

const bash = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/bash' }),
    schema: z.object({
        title: z.string(),
        edition: z.string(),
        date: z.coerce.date(),
        recap: z.string(),
        assets: z.array(z.object({
            label: z.string(),
            kind: z.enum(['stems', 'photo-pack', 'press-kit', 'video', 'sample-pack']),
            size: z.string(),
            href: z.string(),
        })).default([]),
        cover: z.string().optional(),
    }),
});

export const collections = { events, producers, products, bash };
