import { registerPageScript } from '@lib/shared/utils';

import type { CollectionEntry } from 'astro:content';

const TICK_MILLISECONDS = 1_000;

let isRegistered = false;
let timer: Timer | undefined;

function initUnlocks(): void {
    if (isRegistered) return;

    isRegistered = true;
    registerPageScript(start);
}

function isDownload(data: CollectionEntry<'downloads'>['data']): boolean {
    return Boolean(data.href?.startsWith('/assets/'));
}

function start(signal: AbortSignal) {
    const nodes = document.querySelectorAll<HTMLElement>('[data-unlock]');

    if (!nodes.length) return;

    clearInterval(timer);
    tick(nodes);
    timer = setInterval(() => tick(nodes), TICK_MILLISECONDS);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
}

function tick(nodes: NodeListOf<HTMLElement>) {
    nodes.forEach((node) => {
        const unlocksAt = Date.parse(node.dataset.unlocksAt ?? '');

        if (Number.isFinite(unlocksAt) && unlocksAt <= Date.now()) unlock(node);
    });
}

function toAvailability(data: CollectionEntry<'downloads'>['data']): 'open' | 'pending' | 'scheduled' {
    if (data.available && data.href) return 'open';

    return data.unlocksAt ? 'scheduled' : 'pending';
}

function unlock(node: HTMLElement) {
    const locked = node.querySelector<HTMLElement>('[data-unlock-locked]');
    const ready = node.querySelector<HTMLElement>('[data-unlock-ready]');

    if (!ready) return;

    locked?.setAttribute('hidden', '');
    ready.removeAttribute('hidden');
}

export { initUnlocks, isDownload, toAvailability };
