import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ENTRANCE_PRESETS, FOLDED_PROPERTIES, GUARDED_PRESET, PRESET_NAMES, REST_PROPERTIES, VISIBLE_PRESETS, buildStagger, resolvePreset } from '@lib/motion/presets';
import { getMotionTokens } from '@lib/motion/tokens';

export const MOTION_SELECTOR = '[data-motion], [data-motion-stagger] > *';

const BOOT_PRESETS: MotionPresetName[] = ['rule', 'strike'];

const INTERACTIVE_SELECTOR = 'a[href], button, input, select, summary, textarea, [tabindex]';

const STAGGER_SELECTOR = '[data-motion-stagger]';

const TRIGGER_START = 'top 88%';

const effective = new WeakMap<Element, MotionPresetName>();

const roots = new Map<Element, MotionRoot>();

export function buildEntrances(): void {
    const tokens = getMotionTokens();

    roots.clear();

    for (const container of document.querySelectorAll<HTMLElement>(STAGGER_SELECTOR)) {
        const preset = resolvePreset(container.dataset.motionStagger);
        const nested = container.parentElement?.closest(STAGGER_SELECTOR);
        const targets = Array.from(container.children);

        if (!preset || nested || !targets.length) continue;

        roots.set(container, { preset, targets });
    }

    for (const element of document.querySelectorAll<HTMLElement>('[data-motion]')) {
        const preset = resolvePreset(element.dataset.motion);

        if (!preset || element.closest(STAGGER_SELECTOR)) continue;

        roots.set(element, { preset, targets: [element] });
    }

    for (const root of roots.values()) {
        for (const target of root.targets) {
            const preset = resolveEffective(root.preset, target);

            if (!preset) continue;

            effective.set(target, preset);

            if (BOOT_PRESETS.includes(preset)) gsap.set(target, ENTRANCE_PRESETS[preset].from(tokens));
        }
    }

    for (const name of PRESET_NAMES) {
        const containers = [...roots].filter(([, root]) => root.preset === name).map(([container]) => container);

        if (!containers.length) continue;

        ScrollTrigger.batch(containers, {
            onEnter: entered => playEntrance(entered.flatMap(container => roots.get(container)?.targets ?? [])),
            once: true,
            start: TRIGGER_START,
        });
    }
}

function clearRest(targets: Element[], properties: string): void {
    gsap.set(targets, { clearProps: properties });

    for (const target of targets) {
        if (!(target instanceof HTMLElement)) continue;

        for (const property of FOLDED_PROPERTIES) target.style.removeProperty(property);
    }
}

function isGuarded(target: Element): boolean {
    return target.matches(INTERACTIVE_SELECTOR) || Boolean(target.querySelector(INTERACTIVE_SELECTOR));
}

function motionTargets(): Element[] {
    return Array.from(document.querySelectorAll(MOTION_SELECTOR));
}

function playEntrance(targets: Element[]): void {
    const groups = new Map<MotionPresetName, Element[]>();

    for (const target of targets) {
        const name = effective.get(target);

        if (!name) continue;

        groups.set(name, [...groups.get(name) ?? [], target]);
    }

    for (const [name, group] of groups) playPreset(group, name);
}

function playPreset(targets: Element[], name: MotionPresetName): void {
    const preset = ENTRANCE_PRESETS[name];
    const tokens = getMotionTokens();

    const toVars: gsap.TweenVars = {
        ...preset.to(),
        duration: tokens.duration[preset.duration],
        ease: tokens.ease[preset.ease],
        onComplete: () => clearRest(targets, REST_PROPERTIES),
        overwrite: 'auto',
        stagger: buildStagger(targets.length, preset.stagger),
    };

    gsap.fromTo(targets, preset.from(tokens), toVars);
}

function resolveEffective(preset: MotionPresetName, target: Element): MotionPresetName | undefined {
    if (!isGuarded(target)) return preset;

    return VISIBLE_PRESETS.includes(preset) ? undefined : GUARDED_PRESET;
}

export function revealAll(): void {
    const targets = motionTargets();

    if (!targets.length) return;

    gsap.killTweensOf(targets);
    clearRest(targets, `${REST_PROPERTIES},opacity`);
}

export function revealTarget(target: Element): void {
    gsap.killTweensOf(target);
    clearRest([target], REST_PROPERTIES);
    gsap.set(target, { opacity: 1 });
}
