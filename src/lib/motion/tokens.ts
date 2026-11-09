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
};

const FALLBACK_DATA_KEY = 'motionTokenFallback';
const MILLISECONDS_PER_SECOND = 1_000;

const SCALAR_FALLBACKS = {
    '--motion-travel': 24,
    '--stagger-max-total': 0.45,
};

const STAGGER_FALLBACKS: Record<MotionStaggerToken, number> = {
    base: 0.07,
    tight: 0.035,
};

let cache: MotionTokens | undefined;
let fallbacks: string[] = [];

function createCubicBezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1;
    const cy = 3 * y1;

    const bx = 3 * (x2 - x1) - cx;
    const by = 3 * (y2 - y1) - cy;

    const ax = 1 - cx - bx;
    const ay = 1 - cy - by;

    return function solve(progress: number) {
        if (progress <= 0) return 0;
        if (progress >= 1) return 1;

        let t = progress;

        for (let index = 0; index < BEZIER_ITERATIONS; index += 1) {
            const error = ((ax * t + bx) * t + cx) * t - progress;

            if (Math.abs(error) < BEZIER_EPSILON) break;

            const slope = (3 * ax * t + 2 * bx) * t + cx;

            if (Math.abs(slope) < BEZIER_EPSILON) break;

            t -= error / slope;
        }

        return ((ay * t + by) * t + cy) * t;
    };
}

function getMotionTokens(): MotionTokens {
    if (cache) return cache;

    fallbacks = [];

    const duration = {} as MotionTokens['duration'];
    const ease = {} as MotionTokens['ease'];
    const stagger = {} as MotionTokens['stagger'];
    const styles = getComputedStyle(document.documentElement);

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
        duration,
        ease,
        stagger,
        staggerMaxTotal: readNumber(styles, '--stagger-max-total', SCALAR_FALLBACKS['--stagger-max-total']),
        travel: readNumber(styles, '--motion-travel', SCALAR_FALLBACKS['--motion-travel']),
    };

    surfaceFallbacks();

    return cache;
}

function readColorToken(styles: CSSStyleDeclaration, name: string): string {
    return styles.getPropertyValue(name).trim();
}

function readEase(styles: CSSStyleDeclaration, name: string, fallback: MotionBezier) {
    const match = CUBIC_BEZIER_PATTERN.exec(styles.getPropertyValue(name));

    const points = match ? match[1].split(',').map(Number) : [];

    const isValid = points.length === fallback.length && points.every(Number.isFinite);

    if (!isValid) fallbacks.push(name);

    const [x1, y1, x2, y2] = isValid ? points : fallback;

    return createCubicBezier(x1, y1, x2, y2);
}

function readNumber(styles: CSSStyleDeclaration, name: string, fallback: number) {
    const raw = styles.getPropertyValue(name).trim();

    const parsed = Number.parseFloat(raw);

    if (!Number.isFinite(parsed)) {
        fallbacks.push(name);

        return fallback;
    }

    return raw.endsWith('ms') ? parsed / MILLISECONDS_PER_SECOND : parsed;
}

function refreshMotionTokens(): void {
    cache = undefined;
}

function surfaceFallbacks() {
    const root = document.documentElement;

    if (!fallbacks.length) {
        delete root.dataset[FALLBACK_DATA_KEY];

        return;
    }

    root.dataset[FALLBACK_DATA_KEY] = [...new Set(fallbacks)].join(' ');
}

export { getMotionTokens, readColorToken, refreshMotionTokens };
