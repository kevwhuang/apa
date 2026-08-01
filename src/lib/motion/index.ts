import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget } from '@lib/motion/entrances';
import { REDUCED_MOTION_QUERY } from '@lib/constants';
import { clearTransport, initTransport } from '@lib/motion/transport';
import { initCounters } from '@lib/motion/counter';
import { initHeroField } from '@lib/motion/hero';
import { refreshMotionTokens } from '@lib/motion/tokens';
import { registerPageScript } from '@lib/utils';

const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

let context: gsap.Context | undefined;
let controller: AbortController | undefined;
let lastViewportWidth = window.innerWidth;
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
            initTransport();
            initHeroField(signal, false);
        });
    } catch {
        hardDisarm();

        return;
    }

    refreshTriggers();
}

function handleAfterPrint(): void {
    window.__apaMotion?.arm();
    reboot();
}

function handleBeforePrint(): void {
    teardown();
    hardDisarm();
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

function reboot(): void {
    teardown();
    controller = new AbortController();
    boot(controller.signal);
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
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    ScrollTrigger.clearScrollMemory();
    clearTransport();
}

gsap.registerPlugin(ScrollTrigger);
