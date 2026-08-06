import { registerPageScript, setText } from '@lib/shared/utils';

import type { CollectionEntry } from 'astro:content';

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const TICK_MS = 1_000;
const UNLOCKED_MESSAGE = 'any moment now';

let registered = false;
let timer: Timer | undefined;

function formatRemaining(milliseconds: number): string {
    const total = Math.max(0, Math.floor(milliseconds / MILLISECONDS_PER_SECOND));

    const days = Math.floor(total / SECONDS_PER_DAY);
    const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = total % SECONDS_PER_MINUTE;

    const parts = [
        days > 0 ? `${days}d` : '',
        days > 0 || hours > 0 ? `${hours}h` : '',
        `${minutes}m`,
        `${seconds}s`,
    ];

    return parts.filter(Boolean).join(' ');
}

function initUnlocks(): void {
    if (registered) return;

    registered = true;
    registerPageScript(start);
}

function start(signal: AbortSignal): void {
    const nodes = document.querySelectorAll<HTMLElement>('[data-unlock]');

    if (!nodes.length) return;

    clearInterval(timer);
    tick(nodes);
    timer = setInterval(() => tick(nodes), TICK_MS);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
}

function tick(nodes: NodeListOf<HTMLElement>): void {
    nodes.forEach((node) => {
        const unlocksAt = Date.parse(node.dataset.unlocksAt ?? '');

        if (!Number.isFinite(unlocksAt)) return;

        const remaining = unlocksAt - Date.now();

        if (remaining <= 0) {
            unlock(node);

            return;
        }

        setText(node.querySelector('[data-unlock-remaining]'), formatRemaining(remaining));
    });
}

function toAvailability(data: CollectionEntry<'downloads'>['data']): 'open' | 'pending' | 'scheduled' {
    if (data.available && data.href) return 'open';

    return data.unlocksAt ? 'scheduled' : 'pending';
}

function unlock(node: HTMLElement): void {
    const locked = node.querySelector<HTMLElement>('[data-unlock-locked]');
    const ready = node.querySelector<HTMLElement>('[data-unlock-ready]');

    if (!ready) {
        setText(node.querySelector('[data-unlock-remaining]'), UNLOCKED_MESSAGE);

        return;
    }

    locked?.setAttribute('hidden', '');
    ready.removeAttribute('hidden');
}

export { initUnlocks, toAvailability };
