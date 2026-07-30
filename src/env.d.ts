/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type Timer = ReturnType<typeof setInterval>;

interface CartItem {
    color?: string;
    image: string;
    priceCents: number;
    productSlug: string;
    quantity: number;
    size?: string;
    title: string;
}

interface ImportMetaEnv {
    readonly SUPABASE_PUBLISHABLE_KEY: string;
    readonly SUPABASE_URL: string;
}
