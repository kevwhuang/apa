import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ENTRANCE_PRESETS, FOLDED_PROPERTIES, GUARDED_PRESET, PRESET_NAMES, REST_PROPERTIES, VISIBLE_PRESETS, buildStagger, resolvePreset } from '@lib/motion/presets';
import { getMotionTokens } from '@lib/motion/tokens';

const INTERACTIVE_SELECTOR = 'a[href], button, input, select, summary, textarea, [tabindex]:not([tabindex="-1"])';
const MOTION_SELECTOR = '[data-motion], [data-motion-stagger] > *';
const STAGGER_SELECTOR = '[data-motion-stagger]';
const TRIGGER_START = 'top 85%';
const WILL_CHANGE = 'transform';

const effective = new WeakMap<Element, MotionPresetName>();
const revealed = new WeakSet<Element>();
const waiting = new Set<Element>();

function buildEntrances(): void {
    const batches = new Map<MotionPresetName, Element[]>();
    const roots: MotionRoot[] = [];
    const stranded = new Set<Element>();
    const tokens = getMotionTokens();

    waiting.clear();

    for (const container of document.querySelectorAll<HTMLElement>(STAGGER_SELECTOR)) {
        const nested = container.parentElement?.closest(STAGGER_SELECTOR);
        const preset = resolvePreset(container.dataset.motionStagger);
        const targets = Array.from(container.children);

        if (nested || !preset || !targets.length) {
            for (const target of targets) stranded.add(target);

            continue;
        }

        roots.push({ preset, targets });
    }

    for (const element of document.querySelectorAll<HTMLElement>('[data-motion]')) {
        const preset = resolvePreset(element.dataset.motion);

        if (element.closest(STAGGER_SELECTOR) || !preset) {
            stranded.add(element);

            continue;
        }

        roots.push({ preset, targets: [element] });
    }

    for (const root of roots) {
        for (const target of root.targets) {
            const preset = resolveEffective(root.preset, target);

            if (preset) stranded.delete(target);
            else stranded.add(target);

            if (!preset || revealed.has(target)) continue;

            const batch = batches.get(preset) ?? [];

            batch.push(target);
            batches.set(preset, batch);
            effective.set(target, preset);

            if (VISIBLE_PRESETS.includes(preset)) gsap.set(target, ENTRANCE_PRESETS[preset].from(tokens));
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

function clearRest(targets: Element[], properties: string) {
    gsap.set(targets, { clearProps: properties });

    for (const target of targets) {
        if (!(target instanceof HTMLElement)) continue;

        for (const property of FOLDED_PROPERTIES) target.style.removeProperty(property);
    }
}

function markStarted(this: gsap.core.Tween) {
    for (const target of this.targets<Element>()) waiting.delete(target);
}

function playEntrance(entering: Element[]) {
    const groups = new Map<MotionPresetName, MotionGroup>();
    const names = new Set(entering.map(target => effective.get(target)));

    for (const target of new Set([...waiting, ...entering])) {
        const name = effective.get(target);

        if (!name || !names.has(name) || revealed.has(target)) continue;

        const group = groups.get(name) ?? { name, targets: [] };

        group.targets.push(target);
        groups.set(name, group);
    }

    for (const group of groups.values()) playPreset(group);
}

function playPreset({ name, targets }: MotionGroup) {
    const preset = ENTRANCE_PRESETS[name];
    const tokens = getMotionTokens();

    targets.sort((first, second) => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    for (const target of targets) {
        if (waiting.has(target)) gsap.killTweensOf(target);
    }

    for (const target of targets) waiting.add(target);

    const offset = gsap.utils.distribute(buildStagger(targets.length, preset.stagger));

    const timeline = gsap.timeline({
        onComplete: () => clearRest(targets.filter(target => !waiting.has(target)), REST_PROPERTIES),
        onStart: () => gsap.set(targets, { willChange: WILL_CHANGE }),
        onUpdate: () => restoreRevealed(targets),
    });

    targets.forEach((target, index) => {
        timeline.fromTo(target, preset.from(tokens), {
            ...preset.to(),
            duration: tokens.duration[preset.duration],
            ease: tokens.ease[preset.ease],
            onStart: markStarted,
            overwrite: 'auto',
        }, offset(index, target, targets));
    });
}

function resolveEffective(preset: MotionPresetName, target: Element) {
    if (!target.matches(INTERACTIVE_SELECTOR)) return preset;

    return VISIBLE_PRESETS.includes(preset) ? undefined : GUARDED_PRESET;
}

function restoreRevealed(targets: Element[]) {
    const pending = targets.filter(target => revealed.has(target));

    if (!pending.length) return;

    clearRest(pending, REST_PROPERTIES);
    gsap.set(pending, { opacity: 1 });
}

function revealAll(): void {
    const targets = Array.from(document.querySelectorAll(MOTION_SELECTOR));

    if (!targets.length) return;

    gsap.killTweensOf(targets);
    clearRest(targets, `${REST_PROPERTIES},opacity`);
}

function revealElement(target: Element) {
    waiting.delete(target);
    gsap.killTweensOf(target);
    clearRest([target], REST_PROPERTIES);
    gsap.set(target, { opacity: 1 });
    revealed.add(target);
}

function revealTarget(target: Element): void {
    let node: Element | null = target;

    while (node) {
        revealElement(node);
        node = node.parentElement?.closest(MOTION_SELECTOR) ?? null;
    }
}

export { MOTION_SELECTOR, buildEntrances, revealAll, revealTarget };
