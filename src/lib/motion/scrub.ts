import gsap from 'gsap';

import { REDUCED_MOTION_QUERY } from '@lib/shared/constants';
import { getMotionTokens } from '@lib/motion/tokens';

const DRIFT_SCRUB = 0.6;
const DRIFT_SHIFT = 6;
const FLOAT_SCRUB = 1.2;
const FLOAT_SHIFT = 24;
const HERO_SELECTOR = '.hero__field';
const MOBILE_WIDTH = 768;
const SCRUB_END = 'bottom top';

const SCRUB_PRESETS: Record<MotionScrubName, MotionScrubPreset> = {
    drift: {
        from: { yPercent: -DRIFT_SHIFT },
        scrub: DRIFT_SCRUB,
        to: { yPercent: DRIFT_SHIFT },
    },
    float: {
        from: { y: FLOAT_SHIFT },
        scrub: FLOAT_SCRUB,
        to: { y: -FLOAT_SHIFT },
    },
};

const SCRUB_SELECTOR = '[data-scrub]';
const SCRUB_START = 'top bottom';
const SCRUB_VARIANTS = Object.keys(SCRUB_PRESETS) as MotionScrubName[];

const tweens: gsap.core.Tween[] = [];

function clearScrub(): void {
    for (const tween of tweens) {
        tween.scrollTrigger?.kill();
        tween.revert();
    }

    tweens.length = 0;
}

function initScrub(): void {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches || window.innerWidth <= MOBILE_WIDTH) return;

    const tokens = getMotionTokens();

    for (const element of document.querySelectorAll<HTMLElement>(SCRUB_SELECTOR)) {
        const variant = resolveScrub(element.dataset.scrub);

        if (!variant || element.closest(HERO_SELECTOR)) continue;

        const preset = SCRUB_PRESETS[variant];

        tweens.push(gsap.fromTo(element, preset.from, {
            ...preset.to,
            ease: tokens.ease.linear,
            overwrite: 'auto',
            scrollTrigger: {
                end: SCRUB_END,
                scrub: preset.scrub,
                start: SCRUB_START,
                trigger: element,
            },
        }));
    }
}

function resolveScrub(name: string | undefined): MotionScrubName | undefined {
    return SCRUB_VARIANTS.find(variant => variant === name);
}

export { clearScrub, initScrub };
