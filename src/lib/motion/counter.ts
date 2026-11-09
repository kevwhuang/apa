import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { buildStagger } from '@lib/motion/presets';
import { getMotionTokens } from '@lib/motion/tokens';

const COUNTER_SELECTOR = '[data-motion-count]';
const CYCLE_PERCENT = 50;
const DIGITS = '0123456789';
const DIGIT_PATTERN = /\d/;
const REEL_CYCLES = 2;
const TRIGGER_START = 'top 85%';

const rest = new WeakMap<Element, number>();

function buildOdometer(host: HTMLElement, display: string) {
    const reader = document.createElement('span');
    const track = document.createElement('span');

    reader.className = 'sr-only';
    reader.textContent = display;
    track.className = 'odometer inline-flex items-start leading-none tabular-nums select-none';
    track.setAttribute('aria-hidden', 'true');

    const reels: HTMLElement[] = [];

    for (const character of display) {
        if (!DIGIT_PATTERN.test(character)) {
            track.append(createFixed(character));

            continue;
        }

        const reel = createReel();
        const slot = document.createElement('span');

        slot.className = 'odometer__slot block overflow-hidden h-lh';
        reels.push(reel);
        rest.set(reel, -(DIGITS.length + Number(character)) * (CYCLE_PERCENT / DIGITS.length));
        slot.append(reel);
        track.append(slot);
    }

    host.replaceChildren(reader, track);

    return reels;
}

function createFixed(character: string) {
    const fixed = document.createElement('span');

    fixed.className = 'odometer__fixed block h-lh';
    fixed.textContent = character;

    return fixed;
}

function createReel() {
    const reel = document.createElement('span');

    reel.className = 'odometer__reel block';

    for (let cycle = 0; cycle < REEL_CYCLES; cycle += 1) {
        for (const digit of DIGITS) {
            const cell = document.createElement('span');

            cell.className = 'odometer__digit block h-lh';
            cell.textContent = digit;
            reel.append(cell);
        }
    }

    return reel;
}

function getRest(reel: Element) {
    return rest.get(reel) ?? 0;
}

function initCounters(): void {
    const tokens = getMotionTokens();

    for (const host of document.querySelectorAll<HTMLElement>(COUNTER_SELECTOR)) {
        const display = host.dataset.motionCount;

        if (!display || host.querySelector('.odometer')) continue;

        const reels = buildOdometer(host, display);

        if (!reels.length) continue;

        gsap.set(reels, { yPercent: (_index: number, reel: Element) => getRest(reel) });

        ScrollTrigger.create({
            onEnter: () => rollReels(reels, tokens),
            once: true,
            start: TRIGGER_START,
            trigger: host,
        });
    }
}

function rollReels(reels: HTMLElement[], tokens: MotionTokens) {
    gsap.from(reels, {
        duration: tokens.duration.slowest,
        ease: tokens.ease.mechanical,
        onComplete: () => gsap.set(reels, { clearProps: 'willChange' }),
        onStart: () => gsap.set(reels, { willChange: 'transform' }),
        stagger: buildStagger(reels.length, 'tight', 'end'),
        yPercent: (_index: number, reel: Element) => getRest(reel) + CYCLE_PERCENT,
    });
}

export { initCounters };
