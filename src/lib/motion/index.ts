import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget } from '@lib/motion/entrances';
import { REDUCED_MOTION_QUERY } from '@lib/constants';
import { clearScrub, initScrub } from '@lib/motion/scrub';
import { clearTransport, initTransport } from '@lib/motion/transport';
import { initCounters } from '@lib/motion/counter';
import { initHeroField } from '@lib/motion/hero';
import { refreshMotionTokens } from '@lib/motion/tokens';
import { registerPageScript } from '@lib/utils';

const GROWTH_DELAY_MS = 200;

const GROWTH_THRESHOLD = 24;

const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

let context: gsap.Context | undefined;
let controller: AbortController | undefined;
let heightObserver: ResizeObserver | undefined;
let lastDocumentHeight = 0;
let lastViewportWidth = window.innerWidth;
let refreshTimer: Timer | undefined;
let registered = false;

function boot(signal: AbortSignal): void {
    refreshMotionTokens();

    if (reducedMotionQuery.matches) {
        hardDisarm();
        initHeroField(signal, true);

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
            initHeroField(signal, false);
        });
    } catch {
        hardDisarm();

        return;
    }

    observeDocumentHeight();
    void refreshTriggers();
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

function hardDisarm(): void {
    window.__apaMotion?.disarm();
    revealAll();
}

export function initMotion(): void {
    if (registered) return;

    registered = true;

    registerPageScript(start);
    reducedMotionQuery.addEventListener('change', handlePreferenceChange);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('resize', handleResize);
}

function observeDocumentHeight(): void {
    lastDocumentHeight = documentHeight();
    heightObserver = new ResizeObserver(handleDocumentResize);
    heightObserver.observe(document.body);
}

function reboot(): void {
    teardown();
    controller = new AbortController();
    boot(controller.signal);
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
    const previous = controller;

    controller = undefined;
    previous?.abort();
    context?.revert();
    context = undefined;
    clearTimeout(refreshTimer);
    heightObserver?.disconnect();
    heightObserver = undefined;
    refreshTimer = undefined;
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    ScrollTrigger.clearScrollMemory();
    clearScrub();
    clearTransport();
}

gsap.registerPlugin(ScrollTrigger);
