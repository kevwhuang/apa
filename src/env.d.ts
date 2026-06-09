/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

interface CartItem {
    color?: string;
    image: string;
    priceCents: number;
    productSlug: string;
    quantity: number;
    size?: string;
    title: string;
}
