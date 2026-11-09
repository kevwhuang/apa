import gsap from 'gsap';

import { MOBILE_WIDTH, REDUCED_MOTION_QUERY } from '@lib/shared/constants';
import { getMotionTokens } from '@lib/motion/tokens';

const DRIFT_SCRUB = 0.6;
const DRIFT_SHIFT = 6;
const HERO_SELECTOR = '.hero__field';
const SCRUB_END = 'bottom top';
const SCRUB_SELECTOR = '[data-scrub]';
const SCRUB_START = 'top bottom';

const SCRUB_PRESETS: Record<MotionScrubName, MotionScrubPreset> = {
    drift: {
        from: { yPercent: -DRIFT_SHIFT },
        scrub: DRIFT_SCRUB,
        to: { yPercent: DRIFT_SHIFT },
    },
};

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
    if (window.innerWidth <= MOBILE_WIDTH || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    const tokens = getMotionTokens();

    for (const element of document.querySelectorAll<HTMLElement>(SCRUB_SELECTOR)) {
        const variant = SCRUB_VARIANTS.find(name => name === element.dataset.scrub);

        if (element.closest(HERO_SELECTOR) || !variant) continue;

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

export { clearScrub, initScrub };
