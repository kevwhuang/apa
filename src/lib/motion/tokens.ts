const BEZIER_EPSILON = 0.000_001;

const BEZIER_ITERATIONS = 8;

const CUBIC_BEZIER_PATTERN = /cubic-bezier\(([^)]+)\)/;

const DURATION_FALLBACKS: Record<MotionDurationToken, number> = {
    base: 0.25,
    cinematic: 1.4,
    fast: 0.2,
    slow: 0.3,
    slower: 0.5,
    slowest: 0.7,
};

const EASE_FALLBACKS: Record<MotionEaseToken, MotionBezier> = {
    entrance: [0.16, 1, 0.3, 1],
    linear: [0, 0, 1, 1],
    mechanical: [0.83, 0, 0.17, 1],
    snap: [0.34, 1.5, 0.64, 1],
    standard: [0.4, 0, 0.2, 1],
};

const FALLBACK_DATA_KEY = 'motionTokenFallback';

const MILLISECONDS_PER_SECOND = 1_000;

const SCALAR_FALLBACKS = {
    '--hero-field-alpha-max': 0.11,
    '--motion-travel': 24,
    '--motion-travel-lg': 34,
    '--stagger-max-total': 0.45,
    '--transport-velocity-cap': 2_400,
};

const STAGGER_FALLBACKS: Record<MotionStaggerToken, number> = {
    base: 0.07,
    tight: 0.035,
};

let cache: MotionTokens | undefined;
let fallbacks: string[] = [];

function cubicBezier(x1: number, y1: number, x2: number, y2: number): MotionEase {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    function sampleX(t: number) {
        return ((ax * t + bx) * t + cx) * t;
    }

    function sampleY(t: number) {
        return ((ay * t + by) * t + cy) * t;
    }

    function slopeX(t: number) {
        return (3 * ax * t + 2 * bx) * t + cx;
    }

    return function solve(progress: number) {
        if (progress <= 0) return 0;
        if (progress >= 1) return 1;

        let t = progress;

        for (let index = 0; index < BEZIER_ITERATIONS; index += 1) {
            const error = sampleX(t) - progress;

            if (Math.abs(error) < BEZIER_EPSILON) break;

            const slope = slopeX(t);

            if (Math.abs(slope) < BEZIER_EPSILON) break;

            t -= error / slope;
        }

        return sampleY(t);
    };
}

export function getMotionTokens(): MotionTokens {
    if (cache) return cache;

    fallbacks = [];

    const styles = getComputedStyle(document.documentElement);

    const duration = {} as MotionTokens['duration'];
    const ease = {} as MotionTokens['ease'];
    const stagger = {} as MotionTokens['stagger'];

    for (const key of Object.keys(DURATION_FALLBACKS) as MotionDurationToken[]) {
        duration[key] = readNumber(styles, `--duration-${key}`, DURATION_FALLBACKS[key]);
    }

    for (const key of Object.keys(EASE_FALLBACKS) as MotionEaseToken[]) {
        ease[key] = readEase(styles, `--motion-ease-${key}`, EASE_FALLBACKS[key]);
    }

    for (const key of Object.keys(STAGGER_FALLBACKS) as MotionStaggerToken[]) {
        stagger[key] = readNumber(styles, `--stagger-${key}`, STAGGER_FALLBACKS[key]);
    }

    cache = {
        alphaMax: readNumber(styles, '--hero-field-alpha-max', SCALAR_FALLBACKS['--hero-field-alpha-max']),
        duration,
        ease,
        stagger,
        staggerMaxTotal: readNumber(styles, '--stagger-max-total', SCALAR_FALLBACKS['--stagger-max-total']),
        travel: readNumber(styles, '--motion-travel', SCALAR_FALLBACKS['--motion-travel']),
        travelLarge: readNumber(styles, '--motion-travel-lg', SCALAR_FALLBACKS['--motion-travel-lg']),
        velocityCap: readNumber(styles, '--transport-velocity-cap', SCALAR_FALLBACKS['--transport-velocity-cap']),
    };

    surfaceFallbacks();

    return cache;
}

export function readColorToken(styles: CSSStyleDeclaration, name: string): string {
    return styles.getPropertyValue(name).trim();
}

function readEase(styles: CSSStyleDeclaration, name: string, fallback: MotionBezier): MotionEase {
    const match = CUBIC_BEZIER_PATTERN.exec(styles.getPropertyValue(name));
    const points = match ? match[1].split(',').map(Number) : [];
    const valid = points.length === fallback.length && points.every(Number.isFinite);

    if (!valid) fallbacks.push(name);

    const [x1, y1, x2, y2] = valid ? points : fallback;

    return cubicBezier(x1, y1, x2, y2);
}

function readNumber(styles: CSSStyleDeclaration, name: string, fallback: number): number {
    const raw = styles.getPropertyValue(name).trim();
    const parsed = Number.parseFloat(raw);

    if (!Number.isFinite(parsed)) {
        fallbacks.push(name);

        return fallback;
    }

    return raw.endsWith('ms') ? parsed / MILLISECONDS_PER_SECOND : parsed;
}

export function refreshMotionTokens(): void {
    cache = undefined;
}

function surfaceFallbacks(): void {
    const root = document.documentElement;

    if (!fallbacks.length) {
        delete root.dataset[FALLBACK_DATA_KEY];

        return;
    }

    root.dataset[FALLBACK_DATA_KEY] = [...new Set(fallbacks)].join(' ');
}
