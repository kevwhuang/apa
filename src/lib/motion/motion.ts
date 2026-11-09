import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget } from '@lib/motion/entrances';
import { REDUCED_MOTION_QUERY, STORAGE } from '@lib/shared/constants';
import { clearScrub, initScrub } from '@lib/motion/scrub';
import { initCounters } from '@lib/motion/counter';
import { initHeroField } from '@lib/motion/hero';
import { refreshMotionTokens } from '@lib/motion/tokens';
import { registerPageScript } from '@lib/shared/utils';

const GROWTH_DELAY_MILLISECONDS = 200;
const GROWTH_THRESHOLD = 24;

const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

let context: gsap.Context | undefined;
let heightObserver: ResizeObserver | undefined;
let heroContext: gsap.Context | undefined;
let heroController: AbortController | undefined;
let isRegistered = false;
let lastDocumentHeight = 0;
let lastViewportWidth = window.innerWidth;
let refreshTimer: Timer | undefined;

function boot() {
    refreshMotionTokens();

    if (reducedMotionQuery.matches) {
        bootHeroField();
        hardDisarm();

        return;
    }

    const isArmed = window.__apaMotion?.live() === true;

    if (!isArmed) hardDisarm();

    try {
        context = gsap.context(() => {
            if (isArmed) buildEntrances();

            initCounters();
            initScrub();
        });
    } catch {
        hardDisarm();

        return;
    }

    bootHeroField();
    observeDocumentHeight();
    void refreshTriggers();
}

function bootHeroField() {
    const controller = new AbortController();

    clearHeroField();
    heroContext = gsap.context(() => initHeroField(controller.signal, reducedMotionQuery.matches));
    heroController = controller;
}

function clearHeroField() {
    const previous = heroController;

    heroContext?.revert();
    previous?.abort();
    heroContext = undefined;
    heroController = undefined;
}

function getDocumentHeight() {
    return document.documentElement.scrollHeight;
}

function handleAfterPrint() {
    window.__apaMotion?.arm();
    reboot();
}

function handleBeforePrint() {
    teardown();
    hardDisarm();
}

function handleDocumentResize() {
    if (Math.abs(getDocumentHeight() - lastDocumentHeight) < GROWTH_THRESHOLD) return;

    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAfterGrowth, GROWTH_DELAY_MILLISECONDS);
}

function handleFocusIn(event: FocusEvent) {
    if (!(event.target instanceof Element)) return;

    const target = event.target.closest(MOTION_SELECTOR);

    if (target) revealTarget(target);
}

function handlePreferenceChange() {
    if (reducedMotionQuery.matches) {
        teardown();
        hardDisarm();

        return;
    }

    window.__apaMotion?.arm();
    reboot();
}

function handleResize() {
    if (window.innerWidth === lastViewportWidth) return;

    lastViewportWidth = window.innerWidth;
    ScrollTrigger.refresh();
}

function handleThemeChange() {
    refreshMotionTokens();
    bootHeroField();
}

function hardDisarm() {
    revealAll();
    window.__apaMotion?.disarm();
}

function initMotion(): void {
    if (isRegistered) return;

    isRegistered = true;
    registerPageScript(start);
    document.addEventListener('focusin', handleFocusIn);
    reducedMotionQuery.addEventListener('change', handlePreferenceChange);
    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener(STORAGE.theme.topic, handleThemeChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('resize', handleResize);
}

function observeDocumentHeight() {
    heightObserver = new ResizeObserver(handleDocumentResize);
    lastDocumentHeight = getDocumentHeight();
    heightObserver.observe(document.body);
}

function reboot() {
    teardown();
    boot();
}

function refreshAfterGrowth() {
    refreshTimer = undefined;
    ScrollTrigger.refresh();
    lastDocumentHeight = getDocumentHeight();
}

async function refreshTriggers() {
    await document.fonts.ready;

    ScrollTrigger.refresh();
}

function start(signal: AbortSignal) {
    signal.addEventListener('abort', teardown, { once: true });
    reboot();
}

function teardown() {
    clearHeroField();
    context?.revert();
    clearTimeout(refreshTimer);
    heightObserver?.disconnect();
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    ScrollTrigger.clearScrollMemory();
    clearScrub();
    context = undefined;
    heightObserver = undefined;
    refreshTimer = undefined;
}

gsap.registerPlugin(ScrollTrigger);

export { initMotion };
