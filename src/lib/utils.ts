export const PALETTE = [
    '#FF4D3A',
    '#2D2B85',
    '#1A1A1A',
    '#D4A843',
    '#6B68D9',
    '#CC3E2E',
    '#3A3530',
    '#FF6B5A',
] as const;

export function applyFilter(
    buttons: NodeListOf<HTMLButtonElement>,
    cards: NodeListOf<HTMLElement>,
    active: string,
    dataKey: string,
    matches: (card: HTMLElement, active: string) => boolean,
): void {
    cards.forEach((c) => {
        c.style.display = matches(c, active) ? '' : 'none';
    });
    buttons.forEach((b) => {
        const on = (b.dataset[dataKey] ?? '') === active;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('filter-on', on);
    });
}

export function formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatDateShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

export function formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function rovingFocus(buttons: NodeListOf<HTMLButtonElement>): void {
    const arr = Array.from(buttons);
    arr.forEach((b, i) => {
        b.addEventListener('keydown', (e) => {
            let next = -1;
            if (e.key === 'ArrowRight') next = (i + 1) % arr.length;
            if (e.key === 'ArrowLeft') next = (i - 1 + arr.length) % arr.length;
            if (next >= 0) {
                e.preventDefault();
                arr[next].focus();
            }
        });
    });
}
