import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ENTRANCE_PRESETS, FOLDED_PROPERTIES, GUARDED_PRESET, PRESET_NAMES, REST_PROPERTIES, VISIBLE_PRESETS, buildStagger, resolvePreset } from '@lib/motion/presets';
import { getMotionTokens } from '@lib/motion/tokens';

const BOOT_PRESETS: MotionPresetName[] = ['rule', 'strike', 'wipe'];
const INTERACTIVE_SELECTOR = 'a[href], button, input, select, summary, textarea, [tabindex]';
const MOTION_SELECTOR = '[data-motion], [data-motion-stagger] > *';
const STAGGER_ORIGINS: MotionStaggerOrigin[] = ['center', 'end', 'start'];
const STAGGER_SELECTOR = '[data-motion-stagger]';
const TRIGGER_START = 'top 88%';
const WILL_CHANGE = 'transform, filter';

const effective = new WeakMap<Element, MotionPresetName>();
const origins = new WeakMap<Element, MotionStaggerOrigin>();
const revealed = new WeakSet<Element>();

function buildEntrances(): void {
    const batches = new Map<MotionPresetName, Element[]>();
    const roots: MotionRoot[] = [];
    const stranded = new Set<Element>();
    const tokens = getMotionTokens();

    for (const container of document.querySelectorAll<HTMLElement>(STAGGER_SELECTOR)) {
        const preset = resolvePreset(container.dataset.motionStagger);
        const nested = container.parentElement?.closest(STAGGER_SELECTOR);
        const targets = Array.from(container.children);

        if (!preset || nested || !targets.length) {
            for (const target of targets) stranded.add(target);

            continue;
        }

        roots.push({ from: resolveOrigin(container.dataset.motionFrom), preset, targets });
    }

    for (const element of document.querySelectorAll<HTMLElement>('[data-motion]')) {
        const preset = resolvePreset(element.dataset.motion);

        if (!preset || element.closest(STAGGER_SELECTOR)) {
            stranded.add(element);

            continue;
        }

        roots.push({ from: resolveOrigin(element.dataset.motionFrom), preset, targets: [element] });
    }

    for (const root of roots) {
        for (const target of root.targets) {
            const preset = resolveEffective(root.preset, target);

            stranded.delete(target);

            if (!preset || revealed.has(target)) continue;

            const batch = batches.get(preset) ?? [];

            batch.push(target);
            batches.set(preset, batch);
            effective.set(target, preset);
            origins.set(target, root.from);

            if (BOOT_PRESETS.includes(preset)) gsap.set(target, ENTRANCE_PRESETS[preset].from(tokens));
        }
    }

    if (stranded.size) gsap.set(Array.from(stranded), { opacity: 1 });

    for (const name of PRESET_NAMES) {
        const targets = batches.get(name);

        if (!targets?.length) continue;

        ScrollTrigger.batch(targets, {
            onEnter: playEntrance,
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
    return target.matches(INTERACTIVE_SELECTOR);
}

function motionTargets(): Element[] {
    return Array.from(document.querySelectorAll(MOTION_SELECTOR));
}

function playEntrance(entering: Element[]): void {
    const groups = new Map<string, MotionGroup>();

    for (const target of entering) {
        const name = effective.get(target);

        if (!name || revealed.has(target)) continue;

        const from = origins.get(target) ?? 'start';
        const key = `${name}:${from}`;
        const group = groups.get(key) ?? { from, name, targets: [] };

        group.targets.push(target);
        groups.set(key, group);
    }

    for (const group of groups.values()) playPreset(group);
}

function playPreset({ from, name, targets }: MotionGroup): void {
    const preset = ENTRANCE_PRESETS[name];
    const tokens = getMotionTokens();

    const toVars: gsap.TweenVars = {
        ...preset.to(),
        duration: tokens.duration[preset.duration],
        ease: tokens.ease[preset.ease],
        onComplete: () => clearRest(targets, REST_PROPERTIES),
        onStart: () => gsap.set(targets, { willChange: WILL_CHANGE }),
        onUpdate: () => restoreRevealed(targets),
        overwrite: 'auto',
        stagger: buildStagger(targets.length, preset.stagger, from),
    };

    gsap.fromTo(targets, preset.from(tokens), toVars);
}

function resolveEffective(preset: MotionPresetName, target: Element): MotionPresetName | undefined {
    if (!isGuarded(target)) return preset;

    return VISIBLE_PRESETS.includes(preset) ? undefined : GUARDED_PRESET;
}

function resolveOrigin(value: string | undefined): MotionStaggerOrigin {
    return STAGGER_ORIGINS.find(origin => origin === value) ?? 'start';
}

function restoreRevealed(targets: Element[]): void {
    const pending = targets.filter(target => revealed.has(target));

    if (!pending.length) return;

    clearRest(pending, REST_PROPERTIES);
    gsap.set(pending, { opacity: 1 });
}

function revealAll(): void {
    const targets = motionTargets();

    if (!targets.length) return;

    gsap.killTweensOf(targets);
    clearRest(targets, `${REST_PROPERTIES},opacity`);
}

function revealElement(target: Element): void {
    revealed.add(target);
    gsap.killTweensOf(target);
    clearRest([target], REST_PROPERTIES);
    gsap.set(target, { opacity: 1 });
}

function revealTarget(target: Element): void {
    let node: Element | null = target;

    while (node) {
        revealElement(node);
        node = node.parentElement?.closest(MOTION_SELECTOR) ?? null;
    }
}

export { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget };
