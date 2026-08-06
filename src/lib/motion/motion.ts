import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget } from '@lib/motion/entrances';
import { REDUCED_MOTION_QUERY, STORAGE } from '@lib/shared/constants';
import { clearScrub, initScrub } from '@lib/motion/scrub';
import { clearTransport, initTransport } from '@lib/motion/transport';
import { initCounters } from '@lib/motion/counter';
import { initHeroField } from '@lib/motion/hero';
import { refreshMotionTokens } from '@lib/motion/tokens';
import { registerPageScript } from '@lib/shared/utils';

const GROWTH_DELAY_MS = 200;
const GROWTH_THRESHOLD = 24;

const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

let context: gsap.Context | undefined;
let heightObserver: ResizeObserver | undefined;
let heroContext: gsap.Context | undefined;
let heroController: AbortController | undefined;
let lastDocumentHeight = 0;
let lastViewportWidth = window.innerWidth;
let refreshTimer: Timer | undefined;
let registered = false;

function boot(): void {
    refreshMotionTokens();

    if (reducedMotionQuery.matches) {
        bootHeroField();
        hardDisarm();

        return;
    }

    const armed = window.__apaMotion?.live() === true;

    if (!armed) hardDisarm();

    try {
        context = gsap.context(() => {
            if (armed) buildEntrances();

            initCounters();
            initScrub();
            initTransport();
        });
    } catch {
        hardDisarm();

        return;
    }

    bootHeroField();
    observeDocumentHeight();
    void refreshTriggers();
}

function bootHeroField(): void {
    const controller = new AbortController();

    clearHeroField();
    heroContext = gsap.context(() => initHeroField(controller.signal, reducedMotionQuery.matches));
    heroController = controller;
}

function clearHeroField(): void {
    const previous = heroController;

    heroContext?.revert();
    previous?.abort();
    heroContext = undefined;
    heroController = undefined;
}

function documentHeight(): number {
    return document.documentElement.scrollHeight;
}

function handleAfterPrint(): void {
    window.__apaMotion?.arm();
    reboot();
}

function handleBeforePrint(): void {
    teardown();
    hardDisarm();
}

function handleDocumentResize(): void {
    if (Math.abs(documentHeight() - lastDocumentHeight) < GROWTH_THRESHOLD) return;

    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAfterGrowth, GROWTH_DELAY_MS);
}

function handleFocusIn(event: FocusEvent): void {
    if (!(event.target instanceof Element)) return;

    const target = event.target.closest(MOTION_SELECTOR);

    if (target) revealTarget(target);
}

function handlePreferenceChange(): void {
    if (reducedMotionQuery.matches) {
        teardown();
        hardDisarm();

        return;
    }

    window.__apaMotion?.arm();
    reboot();
}

function handleResize(): void {
    if (window.innerWidth === lastViewportWidth) return;

    lastViewportWidth = window.innerWidth;
    ScrollTrigger.refresh();
}

function handleThemeChange(): void {
    refreshMotionTokens();
    bootHeroField();
}

function hardDisarm(): void {
    revealAll();
    window.__apaMotion?.disarm();
}

function initMotion(): void {
    if (registered) return;

    registered = true;
    registerPageScript(start);
    document.addEventListener('focusin', handleFocusIn);
    reducedMotionQuery.addEventListener('change', handlePreferenceChange);
    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener(STORAGE.theme.topic, handleThemeChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('resize', handleResize);
}

function observeDocumentHeight(): void {
    heightObserver = new ResizeObserver(handleDocumentResize);
    lastDocumentHeight = documentHeight();
    heightObserver.observe(document.body);
}

function reboot(): void {
    teardown();
    boot();
}

function refreshAfterGrowth(): void {
    refreshTimer = undefined;
    ScrollTrigger.refresh();
    lastDocumentHeight = documentHeight();
}

async function refreshTriggers(): Promise<void> {
    await document.fonts.ready;

    ScrollTrigger.refresh();
}

function start(signal: AbortSignal): void {
    signal.addEventListener('abort', teardown, { once: true });
    reboot();
}

function teardown(): void {
    clearHeroField();
    context?.revert();
    clearTimeout(refreshTimer);
    heightObserver?.disconnect();
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    ScrollTrigger.clearScrollMemory();
    clearScrub();
    clearTransport();
    context = undefined;
    heightObserver = undefined;
    refreshTimer = undefined;
}

gsap.registerPlugin(ScrollTrigger);

export { initMotion };
