import gsap from 'gsap';

import { STEP_COUNT, stepDuration } from '@lib/motion/pattern';
import { getMotionTokens, readColorToken } from '@lib/motion/tokens';

interface FieldOptions {
    accentColor: string;
    holder: HTMLElement;
    inkColor: string;
    signal: AbortSignal;
    still: boolean;
}

const ACCENT_OFFSET = 1.5;

const ACCENT_THRESHOLD = 0.55;

const BED_LEVEL = 0.12;

const BUDGET_BREACH_LIMIT = 12;

const BUDGET_MILLISECONDS = 6;

const BUDGET_WINDOW = 30;

const DOT_RATIO = 0.42;

const DRIFT_PERIOD = 21;

const FIELD_SELECTOR = '.hero__field';

const GLOW_FLOOR = 0.55;

const GLOW_WIDTH = 0.02;

const HASH_COLUMN = 12.9898;

const HASH_ROW = 78.233;

const HASH_SCALE = 43_758.5453;

const MAX_PIXEL_RATIO = 2;

const MILLISECONDS_PER_SECOND = 1_000;

const MOBILE_PITCH_SCALE = 1.5;

const MOBILE_WIDTH = 768;

const PLAYHEAD_END = 100;

const PLAYHEAD_SELECTOR = '.hero__playhead';

const PLAYHEAD_START = 0;

const QUALITY_STEPS = [
    { fps: 24, pitch: 18 },
    { fps: 15, pitch: 27 },
    { fps: 12, pitch: 36 },
];

const RIPPLE_CYCLES = 0.7;

const RIPPLE_PERIOD = 17;

const SLOW_CORE_COUNT = 4;

const SPRITE_LEVELS = 10;

const SWELL_CYCLES = 1.2;

const SWELL_FLOOR = 0.3;

const SWELL_PERIOD = 26;

const SWELL_RANGE = 0.48;

const SWELL_WEIGHT = 0.6;

const TAU = Math.PI * 2;

const VERTICAL_FLOOR = 0.2;

function buildSprites(color: string, pitch: number, ratio: number): HTMLCanvasElement | undefined {
    const cell = Math.ceil(pitch * ratio);
    const sheet = document.createElement('canvas');

    sheet.height = cell;
    sheet.width = cell * SPRITE_LEVELS;

    const context = sheet.getContext('2d');

    if (!context) return undefined;

    context.fillStyle = color;

    for (let level = 1; level < SPRITE_LEVELS; level += 1) {
        const radius = (level / (SPRITE_LEVELS - 1)) * pitch * DOT_RATIO * ratio;

        context.beginPath();
        context.arc(cell * level + cell / 2, cell / 2, radius, 0, Math.PI * 2);
        context.fill();
    }

    return sheet;
}

export function initHeroField(signal: AbortSignal, still: boolean): void {
    initPlayhead(signal, still);

    const holder = document.querySelector<HTMLElement>(FIELD_SELECTOR);
    const styles = getComputedStyle(document.documentElement);
    const accentColor = readColorToken(styles, '--hero-field-accent');
    const inkColor = readColorToken(styles, '--hero-field-ink');

    if (!holder || !accentColor || !inkColor) return;

    mountField({ accentColor, holder, inkColor, signal, still });
}

function mountField({ accentColor, holder, inkColor, signal, still }: FieldOptions): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return;

    const tokens = getMotionTokens();
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const mobile = window.innerWidth <= MOBILE_WIDTH;

    let accentSheet: HTMLCanvasElement | undefined;
    let bed = new Float32Array(0);
    let breaches = 0;
    let columns = 0;
    let cost = 0;
    let frames = 0;
    let handle = 0;
    let inkSheet: HTMLCanvasElement | undefined;
    let last = 0;
    let quality = mobile || slowDevice() ? 1 : 0;
    let rows = 0;
    let running = false;

    function draw(elapsed: number) {
        if (!context || !inkSheet) return;

        const pitch = QUALITY_STEPS[quality].pitch * (mobile ? MOBILE_PITCH_SCALE : 1);
        const cell = Math.ceil(pitch * ratio);
        const drift = 0.5 + 0.5 * Math.sin(TAU * (elapsed / DRIFT_PERIOD));
        const ripplePhase = elapsed / RIPPLE_PERIOD;
        const swellPhase = elapsed / SWELL_PERIOD;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = tokens.alphaMax;

        for (let row = 0; row < rows; row += 1) {
            const depth = (row + 0.5) / rows;
            const ripple = Math.sin(TAU * (ripplePhase + depth * RIPPLE_CYCLES));
            const vertical = VERTICAL_FLOOR + (1 - VERTICAL_FLOOR) * (1 - Math.abs(depth * 2 - 1));

            for (let column = 0; column < columns; column += 1) {
                const fraction = (column + 0.5) / columns;
                const glow = GLOW_FLOOR + (1 - GLOW_FLOOR) * Math.exp(-((fraction - drift) ** 2) / GLOW_WIDTH);
                const swell = Math.sin(TAU * (swellPhase - fraction * SWELL_CYCLES));
                const wave = SWELL_FLOOR + SWELL_RANGE * (0.5 + 0.5 * (SWELL_WEIGHT * swell + (1 - SWELL_WEIGHT) * ripple));
                const energy = wave * vertical * glow + bed[row * columns + column];
                const level = Math.min(Math.floor(energy * SPRITE_LEVELS), SPRITE_LEVELS - 1);

                if (level < 1) continue;

                const x = column * pitch * ratio;
                const y = row * pitch * ratio;

                context.drawImage(inkSheet, cell * level, 0, cell, cell, x, y, cell, cell);

                if (accentSheet && energy > ACCENT_THRESHOLD) {
                    context.drawImage(accentSheet, cell * level, 0, cell, cell, x + ACCENT_OFFSET, y + ACCENT_OFFSET, cell, cell);
                }
            }
        }
    }

    function frame(now: number) {
        handle = requestAnimationFrame(frame);

        const interval = 1 / QUALITY_STEPS[quality].fps;
        const elapsed = now / MILLISECONDS_PER_SECOND;

        if (elapsed - last < interval) return;

        last = elapsed;

        const started = performance.now();

        draw(elapsed);
        watch(performance.now() - started);
    }

    function resize() {
        const pitch = QUALITY_STEPS[quality].pitch * (mobile ? MOBILE_PITCH_SCALE : 1);
        const width = holder.clientWidth;
        const height = holder.clientHeight;

        if (!width || !height) return;

        canvas.height = Math.ceil(height * ratio);
        canvas.width = Math.ceil(width * ratio);
        columns = Math.ceil(width / pitch);
        rows = Math.ceil(height / pitch);
        bed = new Float32Array(columns * rows);

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const noise = Math.sin(column * HASH_COLUMN + row * HASH_ROW) * HASH_SCALE;

                bed[row * columns + column] = (noise - Math.floor(noise)) * BED_LEVEL;
            }
        }

        accentSheet = mobile ? undefined : buildSprites(accentColor, pitch, ratio);
        inkSheet = buildSprites(inkColor, pitch, ratio);
    }

    function start() {
        if (running || still) return;

        running = true;
        last = performance.now() / MILLISECONDS_PER_SECOND;
        handle = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(handle);
    }

    function watch(duration: number) {
        cost += duration;
        frames += 1;

        if (frames < BUDGET_WINDOW) return;

        breaches = cost / frames > BUDGET_MILLISECONDS ? breaches + 1 : 0;
        cost = 0;
        frames = 0;

        if (breaches < BUDGET_BREACH_LIMIT) return;

        breaches = 0;

        if (quality >= QUALITY_STEPS.length - 1) {
            stop();

            return;
        }

        quality += 1;
        resize();
    }

    canvas.className = 'hero__canvas';
    canvas.style.opacity = '0';
    holder.append(canvas);
    resize();
    requestAnimationFrame(() => (canvas.style.opacity = '1'));

    if (still) {
        draw(0);

        signal.addEventListener('abort', () => canvas.remove());

        return;
    }

    const observer = new IntersectionObserver(entries => (entries[0]?.isIntersecting ? start() : stop()));

    observer.observe(holder);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()), { signal });
    window.addEventListener('resize', resize, { signal });
    signal.addEventListener('abort', () => {
        stop();
        observer.disconnect();
        canvas.remove();
    });
}

function initPlayhead(signal: AbortSignal, still: boolean): void {
    const playhead = document.querySelector<HTMLElement>(PLAYHEAD_SELECTOR);

    if (!playhead || still) return;

    const tokens = getMotionTokens();

    const sweep = gsap.fromTo(playhead, { xPercent: PLAYHEAD_START }, {
        duration: STEP_COUNT * stepDuration(),
        ease: tokens.ease.linear,
        repeat: -1,
        xPercent: PLAYHEAD_END,
    });

    const observer = new IntersectionObserver(entries => (entries[0]?.isIntersecting ? sweep.play() : sweep.pause()));

    observer.observe(playhead);
    document.addEventListener('visibilitychange', () => (document.hidden ? sweep.pause() : sweep.play()), { signal });
    signal.addEventListener('abort', () => observer.disconnect());
}

function slowDevice(): boolean {
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };

    return connection?.saveData === true || (navigator.hardwareConcurrency ?? 0) <= SLOW_CORE_COUNT;
}
