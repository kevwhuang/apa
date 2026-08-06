import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { buildStagger } from '@lib/motion/presets';
import { getMotionTokens } from '@lib/motion/tokens';

const COUNTER_SELECTOR = '[data-motion-count]';
const CYCLE_PERCENT = 50;
const DIGITS = '0123456789';
const DIGIT_PATTERN = /\d/;
const REEL_CYCLES = 2;
const TRIGGER_START = 'top 88%';

const rest = new WeakMap<Element, number>();

function buildOdometer(host: HTMLElement, display: string): HTMLElement[] {
    const reader = document.createElement('span');
    const track = document.createElement('span');

    reader.className = 'sr-only';
    reader.textContent = display;
    track.className = 'odometer';
    track.setAttribute('aria-hidden', 'true');

    const reels: HTMLElement[] = [];

    for (const character of display) {
        if (!DIGIT_PATTERN.test(character)) {
            track.append(createFixed(character));

            continue;
        }

        const reel = createReel();
        const slot = document.createElement('span');

        slot.className = 'odometer__slot';
        reels.push(reel);
        rest.set(reel, -(DIGITS.length + Number(character)) * (CYCLE_PERCENT / DIGITS.length));
        slot.append(reel);
        track.append(slot);
    }

    host.replaceChildren(reader, track);

    return reels;
}

function createFixed(character: string): HTMLElement {
    const fixed = document.createElement('span');

    fixed.className = 'odometer__fixed';
    fixed.textContent = character;

    return fixed;
}

function createReel(): HTMLElement {
    const reel = document.createElement('span');

    reel.className = 'odometer__reel';

    for (let cycle = 0; cycle < REEL_CYCLES; cycle += 1) {
        for (const digit of DIGITS) {
            const cell = document.createElement('span');

            cell.className = 'odometer__digit';
            cell.textContent = digit;
            reel.append(cell);
        }
    }

    return reel;
}

function initCounters(): void {
    const tokens = getMotionTokens();

    for (const host of document.querySelectorAll<HTMLElement>(COUNTER_SELECTOR)) {
        const display = host.dataset.motionCount;

        if (!display || host.querySelector('.odometer')) continue;

        const reels = buildOdometer(host, display);

        if (!reels.length) continue;

        gsap.set(reels, { yPercent: (_index: number, reel: Element) => restOf(reel) });

        ScrollTrigger.create({
            onEnter: () => rollReels(reels, tokens),
            once: true,
            start: TRIGGER_START,
            trigger: host,
        });
    }
}

function restOf(reel: Element): number {
    return rest.get(reel) ?? 0;
}

function rollReels(reels: HTMLElement[], tokens: MotionTokens): void {
    gsap.from(reels, {
        duration: tokens.duration.slowest,
        ease: tokens.ease.mechanical,
        onComplete: () => gsap.set(reels, { clearProps: 'willChange' }),
        onStart: () => gsap.set(reels, { willChange: 'transform' }),
        stagger: buildStagger(reels.length, 'tight', 'end'),
        yPercent: (_index: number, reel: Element) => restOf(reel) + CYCLE_PERCENT,
    });
}

export { initCounters };
