const HTML_ESCAPES: Record<string, string> = {
    '"': '&quot;',
    '&': '&amp;',
    '\'': '&#39;',
    '<': '&lt;',
    '>': '&gt;',
};

export const LINKS = {
    email: 'hello@austinproduceralliance.com',
    instagram: 'https://instagram.com/austin_producer_alliance',
    pressEmail: 'press@austinproduceralliance.com',
} as const;

export const PALETTE = [
    '#ff4d3a',
    '#2d2b85',
    '#1a1a1a',
    '#d4a843',
    '#6b68d9',
    '#cc3e2e',
    '#3a3530',
    '#ff6b5a',
] as const;

export const ROUTES = [
    { href: '/events', label: 'Events' },
    { href: '/producers', label: 'Producers' },
    { href: '/bash', label: 'The Bash' },
    { href: '/about', label: 'About' },
    { href: '/store', label: 'Store' },
    { href: '/sponsor', label: 'Sponsor' },
    { href: '/contact', label: 'Contact' },
] as const;

export function applyFilter(
    buttons: NodeListOf<HTMLButtonElement>,
    cards: NodeListOf<HTMLElement>,
    active: string,
    dataKey: string,
    matches: (card: HTMLElement, active: string) => boolean,
): void {
    buttons.forEach((button) => {
        const on = (button.dataset[dataKey] ?? '') === active;

        button.classList.toggle('is-active', on);
        button.setAttribute('aria-pressed', String(on));
    });

    cards.forEach((card) => {
        card.classList.toggle('hidden', !matches(card, active));
    });
}

export function escapeHtml(value: string): string {
    return value.replace(/["&'<>]/g, character => HTML_ESCAPES[character]);
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Chicago',
        weekday: 'short',
        year: 'numeric',
    });
}

export function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
    });
}

export function formatVariant(item: CartItem): string {
    return [item.color, item.size].filter(Boolean).join(' / ');
}

function handleRovingKeydown(event: KeyboardEvent, buttons: HTMLButtonElement[], index: number) {
    let next = -1;

    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;

    if (next < 0) return;

    event.preventDefault();
    buttons[next].focus();
}

export function rovingFocus(buttons: NodeListOf<HTMLButtonElement>, signal?: AbortSignal): void {
    const all = Array.from(buttons);

    all.forEach((button, index) => {
        button.addEventListener('keydown', event => handleRovingKeydown(event, all, index), { signal });
    });
}
