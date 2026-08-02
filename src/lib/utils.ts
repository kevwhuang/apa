import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE, CENTS_PER_DOLLAR, COMMERCE, EVENT_PROGRAMS } from '@lib/constants';

import type { CollectionEntry } from 'astro:content';

export type ProgramEvent = CalendarEvent & { end?: Date };

export interface FilterGroupOptions {
    buttons: NodeListOf<HTMLButtonElement>;
    cards: NodeListOf<HTMLElement>;
    dataKey: string;
    emptyElement?: HTMLElement | null;
    initial: string;
    matches: (card: HTMLElement, active: string) => boolean;
    searchElement?: HTMLInputElement | null;
    signal: AbortSignal;
    status?: (shown: number, total: number, active: string, query: string) => string;
    statusElement?: HTMLElement | null;
}

export interface SearchFieldOptions {
    clearElements: NodeListOf<HTMLButtonElement>;
    searchElement: HTMLInputElement | null;
    signal: AbortSignal;
}

const ISO_DATE_LENGTH = 10;

const MAX_INITIALS = 2;

const SECONDS_PER_MINUTE = 60;

export function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

export function describeCartIssue(issue: CartIssue): string {
    if (issue.kind === 'out-of-stock') return `${issue.title} sold out and was removed.`;
    if (issue.kind === 'price-changed') return `${issue.title} is now ${formatPrice(issue.to ?? 0)}, previously ${formatPrice(issue.from ?? 0)}.`;
    if (issue.kind === 'quantity-reduced') return `${issue.title} was reduced to ${issue.to ?? 0} \u2014 that is all we have left.`;

    return `${issue.title} is no longer in the store and was removed.`;
}

export function formatBytes(bytes: number): string {
    const size = Math.max(0, bytes);

    if (size < BYTES_PER_KILOBYTE) return `${Math.round(size)} B`;
    if (size < BYTES_PER_MEGABYTE) return `${Math.round(size / BYTES_PER_KILOBYTE)} KB`;

    return `${Number((size / BYTES_PER_MEGABYTE).toFixed(1))} MB`;
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

export function formatDateOnly(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        weekday: 'short',
        year: 'numeric',
    });
}

export function formatDateStamp(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Chicago',
        year: 'numeric',
    });
}

export function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainder = Math.floor(seconds % SECONDS_PER_MINUTE);

    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatMonthOnly(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
        year: 'numeric',
    });
}

export function formatPrice(cents: number): string {
    return `$${(cents / CENTS_PER_DOLLAR).toFixed(2)}`;
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
    });
}

export function formatTimeRange(start: Date, end: Date): string {
    return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

export function formatVariant(item: CartItem): string {
    return [item.color, item.size].filter(Boolean).join(' / ');
}

export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    return words.slice(0, MAX_INITIALS).map(word => word.charAt(0).toUpperCase()).join('');
}

export function getProgram(type: EventType): EventProgram {
    return EVENT_PROGRAMS[type];
}

export function getStockLabel(stock: number, inStockLabel = ''): string {
    if (stock === 0) return 'Sold out';
    if (stock <= COMMERCE.lowStockThreshold) return `Only ${stock} left`;

    return inStockLabel;
}

function handleRovingKeydown(event: KeyboardEvent, buttons: HTMLButtonElement[], index: number) {
    let next = -1;

    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;

    if (next < 0) return;

    event.preventDefault();
    buttons[next].focus();
}

export function initFilterGroup(options: FilterGroupOptions): void {
    const { buttons, cards, dataKey, emptyElement, initial, matches, searchElement, signal, status, statusElement } = options;

    let active = initial;

    function apply() {
        const query = (searchElement?.value ?? '').trim();
        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

        let shown = 0;

        buttons.forEach((button) => {
            const on = (button.dataset[dataKey] ?? '') === active;

            button.classList.toggle('is-active', on);
            button.setAttribute('aria-pressed', String(on));
        });

        cards.forEach((card) => {
            const haystack = card.dataset.search ?? '';
            const on = matches(card, active) && tokens.every(token => haystack.includes(token));

            if (on) shown += 1;

            card.classList.toggle('hidden', !on);
        });

        if (emptyElement) {
            setText(emptyElement.querySelector('[data-search-echo]'), query);
            setHidden(emptyElement, shown > 0);
        }

        if (statusElement && status) statusElement.textContent = status(shown, cards.length, active, query);
    }

    function handleClick(button: HTMLButtonElement) {
        active = button.dataset[dataKey] ?? initial;
        apply();
    }

    apply();
    rovingFocus(buttons, signal);

    buttons.forEach((button) => {
        button.addEventListener('click', () => handleClick(button), { signal });
    });

    searchElement?.addEventListener('input', apply, { signal });
}

export function initSearchField(options: SearchFieldOptions): void {
    const { clearElements, searchElement, signal } = options;

    if (!searchElement) return;

    function handleClear(input: HTMLInputElement) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
    }

    function sync(input: HTMLInputElement) {
        const empty = input.value.length === 0;

        clearElements.forEach((button) => {
            button.hidden = empty;
        });
    }

    sync(searchElement);
    searchElement.addEventListener('input', () => sync(searchElement), { signal });

    clearElements.forEach((button) => {
        button.addEventListener('click', () => handleClear(searchElement), { signal });
    });
}

export function mergeAssets(downloads: CollectionEntry<'downloads'>[], docs: CollectionEntry<'docs'>[]): CollectionEntry<'downloads'>[] {
    return downloads
        .map(entry => toAsset(entry, docs))
        .toSorted((a, b) => Number(b.data.available) - Number(a.data.available) || +b.data.date - +a.data.date);
}

export function mergeCalendar(events: CollectionEntry<'events'>[], bashEditions: CollectionEntry<'bash'>[]): Calendar {
    const merged = [...events.map(toCalendarEvent), ...bashEditions.map(toCalendarBashEvent)];

    return {
        past: merged.filter(event => event.status === 'past').sort((a, b) => +b.date - +a.date),
        upcoming: merged.filter(event => event.status === 'upcoming').sort((a, b) => +a.date - +b.date),
    };
}

export function parseCatalog(raw: string | undefined): CatalogEntry[] {
    if (!raw) return [];

    try {
        return JSON.parse(raw) as CatalogEntry[];
    } catch {
        return [];
    }
}

export function registerPageScript(init: (signal: AbortSignal) => void): void {
    let controller: AbortController | undefined;

    function handlePageLoad() {
        teardown();
        controller = new AbortController();
        init(controller.signal);
    }

    function teardown() {
        controller?.abort();
    }

    document.addEventListener('astro:before-swap', teardown);
    document.addEventListener('astro:page-load', handlePageLoad);
}

export function rovingFocus(buttons: NodeListOf<HTMLButtonElement>, signal?: AbortSignal): void {
    const all = Array.from(buttons);

    all.forEach((button, index) => {
        button.addEventListener('keydown', event => handleRovingKeydown(event, all, index), { signal });
    });
}

export function setHidden(element: HTMLElement | null, hidden: boolean): void {
    if (!element) return;

    element.hidden = hidden;
}

export function setMessage(element: HTMLElement | null, message: string): void {
    if (!element) return;

    element.textContent = message;
    element.toggleAttribute('hidden', message.length === 0);
}

export function setPending(control: HTMLButtonElement | null, pending: boolean): void {
    if (!control) return;

    control.disabled = pending;

    if (pending) control.setAttribute('aria-busy', 'true');
    else control.removeAttribute('aria-busy');
}

export function setText(element: Element | null, value: string): void {
    if (element) element.textContent = value;
}

function toAsset(entry: CollectionEntry<'downloads'>, docs: CollectionEntry<'docs'>[]) {
    const doc = docs.find(candidate => candidate.id === entry.data.doc?.id);

    if (!doc) return entry;

    return {
        ...entry,
        data: {
            ...entry.data,
            date: doc.data.updated,
            description: doc.data.description,
            title: doc.data.title,
        },
    };
}

function toCalendarBashEvent(entry: CollectionEntry<'bash'>) {
    return {
        date: entry.data.date,
        excerpt: entry.data.recap,
        id: entry.id,
        location: entry.data.location,
        status: entry.data.status,
        title: entry.data.title,
        type: 'bash' as const,
    };
}

export function toCalendarEvent(entry: CollectionEntry<'events'>) {
    return {
        date: entry.data.date,
        end: entry.data.end,
        excerpt: entry.data.excerpt,
        id: entry.id,
        location: entry.data.location,
        status: entry.data.status,
        title: entry.data.title,
        type: entry.data.type,
    };
}

export function toCatalog(products: CollectionEntry<'products'>[]): CatalogEntry[] {
    return products.map(product => ({
        priceCents: product.data.priceCents,
        slug: product.id,
        stock: product.data.stock,
        title: product.data.title,
    }));
}

export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function toProducerRecord(producer: CollectionEntry<'producers'>): ProducerRecord {
    return {
        avatar: producer.data.avatar ?? null,
        bio: producer.data.bio,
        featured: producer.data.featured,
        genres: producer.data.genres,
        handle: producer.data.handle,
        id: producer.id,
        joined: toIsoDate(producer.data.joined),
        links: producer.data.links,
        location: producer.data.location,
        name: producer.data.name,
        roles: producer.data.roles,
        tracks: producer.data.tracks,
    };
}
