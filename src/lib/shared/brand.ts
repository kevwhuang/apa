import horizontalCream from '@images/brand/apa_horizontal_cream.svg';
import horizontalInk from '@images/brand/apa_horizontal_ink.svg';
import lockup from '@images/brand/apa_horizontal_default.svg';
import symbol from '@images/brand/apa_symbol_default.svg';
import wordmarkCream from '@images/brand/apa_wordmark_cream.svg';

const BRAND = {
    author: 'Kevin Huang',
    name: 'Austin Producer Alliance',
    themeColor: '#f6f1e4',
} as const;

const BRAND_DOWNLOADS = [
    {
        asset: symbol,
        filename: 'apa_symbol_default.svg',
        format: 'svg',
        label: 'Symbol, default',
    },
    {
        asset: wordmarkCream,
        filename: 'apa_wordmark_cream.svg',
        format: 'svg',
        label: 'Wordmark, cream',
    },
    {
        asset: horizontalCream,
        filename: 'apa_horizontal_cream.svg',
        format: 'svg',
        label: 'Lockup, cream',
    },
    {
        asset: horizontalInk,
        filename: 'apa_horizontal_ink.svg',
        format: 'svg',
        label: 'Lockup, ink',
    },
] as const;

const BRAND_ICONS = {
    appleTouch: '/apple-touch-icon.png',
    logo: '/apple-touch-icon.png',
    og: '/og.png',
    png: '/favicon.png',
} as const;

const BRAND_LOGOS = {
    lockup,
    lockupDark: horizontalInk,
    lockupLight: horizontalCream,
    symbol,
} as const;

const BRAND_OG = {
    height: 630,
    width: 1_200,
} as const;

const BRAND_SIZES = {
    lockupNav: 26,
    lockupPreview: 64,
    markNav: 32,
    markPreview: 40,
} as const;

function brandTitle(page: string): string {
    return `${page} — ${BRAND.name}`;
}

export { BRAND, BRAND_DOWNLOADS, BRAND_ICONS, BRAND_LOGOS, BRAND_OG, BRAND_SIZES, brandTitle };
