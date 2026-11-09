import horizontalCream from '@images/brand/apa_horizontal_cream.svg';
import horizontalInk from '@images/brand/apa_horizontal_ink.svg';
import symbol from '@images/brand/apa_symbol_default.svg';
import symbolCream from '@images/brand/apa_symbol_cream.svg';
import symbolInk from '@images/brand/apa_symbol_ink.svg';

const BRAND_ICONS = {
    appleTouch: '/apple-touch-icon.png',
    logo: symbol.src,
    og: '/og.png',
    png: '/favicon.png',
} as const;

const BRAND_LOGOS = {
    lockupDark: horizontalInk,
    lockupLight: horizontalCream,
    symbol,
    symbolDark: symbolInk,
    symbolLight: symbolCream,
} as const;

const BRAND_OG = {
    height: 630,
    width: 1_200,
} as const;

const BRAND_SIZES = {
    lockupNav: 26,
    lockupPreview: 64,
    markNav: 32,
} as const;

const BRAND_THEME_COLORS = {
    dark: '#171310',
    light: '#f6f1e4',
} as const;

const BRAND = {
    author: 'Kevin Huang',
    name: 'Austin Producer Alliance',
    shortName: 'APA',
    themeColor: BRAND_THEME_COLORS.light,
} as const;

function brandTitle(...trail: string[]): string {
    return [...trail, BRAND.shortName].join(' | ');
}

export { BRAND, BRAND_ICONS, BRAND_LOGOS, BRAND_OG, BRAND_SIZES, BRAND_THEME_COLORS, brandTitle };
