import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import robots from 'astro-robots-txt';
import sitemap from '@astrojs/sitemap';
import tailwind from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

const PRIVATE_ROUTES = new Set(['/404', '/500', '/admin', '/here', '/onboarding', '/settings', '/signin', '/store/cart', '/store/checkout', '/store/orders']);

export default defineConfig({
    adapter: netlify(),
    build: {
        format: 'file',
    },
    devToolbar: {
        enabled: false,
    },
    fonts: [
        {
            cssVariable: '--font-bricolage-grotesque',
            display: 'block',
            name: 'Bricolage Grotesque',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: ['200 800'],
        },
        {
            cssVariable: '--font-space-mono',
            display: 'block',
            fallbacks: ['Courier New', 'monospace'],
            name: 'Space Mono',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400, 700],
        },
    ],
    integrations: [
        react(),
        robots(),
        sitemap({ filter: page => !PRIVATE_ROUTES.has(new URL(page).pathname), lastmod: new Date() }),
    ],
    site: 'https://austinproduceralliance.com',
    trailingSlash: 'never',
    vite: {
        plugins: [tailwind()],
    },
});
