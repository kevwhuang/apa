import lockup from '@images/logos/austin_producer_alliance_lockup.svg';
import mark from '@images/logos/austin_producer_alliance.svg';
import square from '@images/logos/austin_producer_alliance_square.png';
import squareInverse from '@images/logos/austin_producer_alliance_square_white.png';

const BRAND = {
    author: 'Kevin Huang',
    name: 'Austin Producer Alliance',
    themeColor: '#f6f1e4',
} as const;

const BRAND_DOWNLOADS = [
    {
        asset: lockup,
        filename: 'austin-producer-alliance-lockup.svg',
        format: 'svg',
        label: 'Lockup',
    },
    {
        asset: mark,
        filename: 'austin-producer-alliance-wordmark.svg',
        format: 'svg',
        label: 'Wordmark',
    },
    {
        asset: square,
        filename: 'austin-producer-alliance-square.png',
        format: 'png',
        label: 'Wordmark on a square canvas',
    },
    {
        asset: squareInverse,
        filename: 'austin-producer-alliance-square-inverse.png',
        format: 'png',
        label: 'Wordmark on a square canvas, inverse',
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
    mark,
} as const;

const BRAND_OG = {
    height: 630,
    width: 1_200,
} as const;

const BRAND_SIZES = {
    lockupFooter: 64,
    markNav: 32,
    markPreview: 40,
} as const;

function brandTitle(page: string): string {
    return `${page} \u2014 ${BRAND.name}`;
}

export { BRAND, BRAND_DOWNLOADS, BRAND_ICONS, BRAND_LOGOS, BRAND_OG, BRAND_SIZES, brandTitle };
