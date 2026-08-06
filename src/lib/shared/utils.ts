import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE, CENTS_PER_DOLLAR, EVENT_PROGRAMS, PALETTE } from '@lib/shared/constants';

import type { CollectionEntry } from 'astro:content';

type ProgramEvent = CalendarEvent & { end?: Date };

interface FilterGroupOptions {
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

interface PanelResizeOptions {
    handle: HTMLElement;
    label: string;
    minWidth: number;
    panel: HTMLElement;
    property: string;
    reservedRight: number;
    signal: AbortSignal;
}

interface SearchFieldOptions {
    clearElements: NodeListOf<HTMLButtonElement>;
    searchElement: HTMLInputElement | null;
    signal: AbortSignal;
}

const EMPTY_TILE_COLOR = 'var(--color-ink-subtle)';
const FLOAT_WINDOW_BASE_Z = 70;
const ISO_DATE_LENGTH = 10;
const MAX_INITIALS = 2;
const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const PANEL_NARROW_VIEWPORT = 480;
const PANEL_RESIZE_STEP = 16;
const PANEL_WIDE_DIVISOR = 2;
const PANEL_WIDE_VIEWPORT = 1_024;
const SECONDS_PER_MINUTE = 60;

const panelWidths = new Map<string, number>();

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function describeCartIssue(issue: CartIssue): string {
    if (issue.kind === 'out-of-stock') return `${issue.title} sold out and was removed.`;
    if (issue.kind === 'price-changed') return `${issue.title} is now ${formatPrice(issue.to ?? 0)}, previously ${formatPrice(issue.from ?? 0)}.`;
    if (issue.kind === 'quantity-reduced') return `${issue.title} was reduced to ${issue.to ?? 0} \u2014 that is all we have left.`;

    return `${issue.title} is no longer in the store and was removed.`;
}

function floatWindowBase(): number {
    return toLevel(getComputedStyle(document.documentElement).getPropertyValue('--z-drawer'), FLOAT_WINDOW_BASE_Z);
}

function formatBytes(bytes: number): string {
    const size = Math.max(0, bytes);

    if (size < BYTES_PER_KILOBYTE) return `${Math.round(size)} B`;
    if (size < BYTES_PER_MEGABYTE) return `${Math.round(size / BYTES_PER_KILOBYTE)} KB`;

    return `${Number((size / BYTES_PER_MEGABYTE).toFixed(1))} MB`;
}

function formatCalendarDay(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: '2-digit',
        timeZone: 'America/Chicago',
    });
}

function formatCalendarMonth(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'America/Chicago',
        year: 'numeric',
    });
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Chicago',
        weekday: 'short',
        year: 'numeric',
    });
}

function formatDateStamp(date: Date): string {
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Chicago',
        year: 'numeric',
    });
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainder = Math.floor(seconds % SECONDS_PER_MINUTE);

    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatPrice(cents: number): string {
    return `$${(cents / CENTS_PER_DOLLAR).toFixed(2)}`;
}

function formatProds(prods: number): string {
    const count = Math.max(0, Math.trunc(prods) || 0);

    return count === 1 ? '1 Prod' : `${count} Prods`;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
    });
}

function formatTimeRange(start: Date, end: Date): string {
    return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

function formatVariant(item: CartItem): string {
    const parts = [item.variation, item.size].filter(Boolean);

    return parts.length > 0 ? parts.join(' / ') : 'Base';
}

function formatWeekday(date: Date): string {
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'long',
    });
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    return words.slice(0, MAX_INITIALS).map(word => word.charAt(0).toUpperCase()).join('');
}

function getProgram(type: EventType): EventProgram {
    return EVENT_PROGRAMS[type];
}

function getStanding(balance: number): string {
    if (balance < 0) return 'In review';
    if (balance === 0) return 'Settled';

    return 'Good standing';
}

function getStockLabel(stock: number, inStockLabel = ''): string {
    if (stock === 0) return 'Sold out';

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

function initFilterGroup(options: FilterGroupOptions): void {
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

function initPanelResize(options: PanelResizeOptions): void {
    const { handle, label, minWidth, panel, property, reservedRight, signal } = options;

    let pointer: number | undefined;

    function apply(width: number) {
        const { max, min } = bounds();

        const next = Math.round(Math.min(Math.max(width, min), max));

        handle.setAttribute('aria-valuemax', String(Math.round(max)));
        handle.setAttribute('aria-valuemin', String(Math.round(min)));
        handle.setAttribute('aria-valuenow', String(next));
        panel.style.setProperty(property, `${next}px`);
        panelWidths.set(property, next);
    }

    function bounds() {
        const max = maxPanelWidth(window.innerWidth, reservedRight);

        return { max, min: Math.min(minWidth, max) };
    }

    function current() {
        const stored = panelWidths.get(property);

        if (stored !== undefined) return stored;

        const measured = panel.getBoundingClientRect().width;

        return measured > 0 ? measured : minWidth;
    }

    function handleKeydown(event: KeyboardEvent) {
        const next = keyWidth(event.key);

        if (next === undefined) return;

        event.preventDefault();
        apply(next);
    }

    function handlePointerDown(event: PointerEvent) {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        pointer = event.pointerId;
    }

    function handlePointerMove(event: PointerEvent) {
        if (pointer !== event.pointerId) return;

        apply(panel.getBoundingClientRect().right - event.clientX);
    }

    function handlePointerUp(event: PointerEvent) {
        if (pointer !== event.pointerId) return;

        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);

        pointer = undefined;
    }

    function handleResize() {
        apply(current());
    }

    function keyWidth(key: string) {
        const { max, min } = bounds();

        if (key === 'ArrowLeft') return current() + PANEL_RESIZE_STEP;
        if (key === 'ArrowRight') return current() - PANEL_RESIZE_STEP;
        if (key === 'End') return max;
        if (key === 'Home') return min;

        return undefined;
    }

    apply(current());
    handle.setAttribute('aria-label', label);
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('role', 'separator');
    handle.tabIndex = 0;
    handle.addEventListener('keydown', handleKeydown, { signal });
    handle.addEventListener('pointercancel', handlePointerUp, { signal });
    handle.addEventListener('pointerdown', handlePointerDown, { signal });
    handle.addEventListener('pointermove', handlePointerMove, { signal });
    handle.addEventListener('pointerup', handlePointerUp, { signal });
    window.addEventListener('resize', handleResize, { signal });
}

function initSearchField(options: SearchFieldOptions): void {
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

function isTopFloatWindow(target: HTMLElement): boolean {
    const base = floatWindowBase();
    const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-float-window]')).filter(element => element.checkVisibility());

    const top = visible.reduce<HTMLElement | undefined>((best, element) => (best && toLevel(best.style.zIndex, base) > toLevel(element.style.zIndex, base) ? best : element), undefined);

    return top === target;
}

function maxPanelWidth(viewportWidth: number, reservedRight: number): number {
    const narrowMax = PANEL_NARROW_VIEWPORT - reservedRight;
    const wideMax = PANEL_WIDE_VIEWPORT / PANEL_WIDE_DIVISOR;

    if (viewportWidth <= PANEL_NARROW_VIEWPORT) return viewportWidth - reservedRight;
    if (viewportWidth >= PANEL_WIDE_VIEWPORT) return viewportWidth / PANEL_WIDE_DIVISOR;

    const ratio = (viewportWidth - PANEL_NARROW_VIEWPORT) / (PANEL_WIDE_VIEWPORT - PANEL_NARROW_VIEWPORT);

    return narrowMax + (wideMax - narrowMax) * ratio;
}

function mergeAssets(downloads: CollectionEntry<'downloads'>[], docs: CollectionEntry<'docs'>[]): CollectionEntry<'downloads'>[] {
    return downloads
        .map(entry => toAsset(entry, docs))
        .toSorted((a, b) => Number(b.data.available) - Number(a.data.available) || a.data.title.localeCompare(b.data.title));
}

function mergeCalendar(events: CollectionEntry<'events'>[], bashEditions: CollectionEntry<'bash'>[]): Calendar {
    const merged = [...events.map(toCalendarEvent), ...bashEditions.map(toCalendarBashEvent)];

    return {
        past: merged.filter(event => event.status === 'past').sort((a, b) => +b.date - +a.date),
        upcoming: merged.filter(event => event.status === 'upcoming').sort((a, b) => +a.date - +b.date),
    };
}

function parseCatalog(raw: string | undefined): CatalogEntry[] {
    return parseJson<CatalogEntry[]>(raw, []);
}

function parseImageSources(raw: string | undefined): ImageSources {
    return parseJson<ImageSources>(raw, {});
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function pickTileColor(seed: string): string {
    if (seed.length === 0) return EMPTY_TILE_COLOR;

    const total = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);

    return PALETTE[total % PALETTE.length];
}

function raiseWindow(target: HTMLElement): void {
    const base = floatWindowBase();

    const ordered = Array.from(document.querySelectorAll<HTMLElement>('[data-float-window]'))
        .filter(element => element !== target)
        .toSorted((a, b) => toLevel(a.style.zIndex, base) - toLevel(b.style.zIndex, base));

    [...ordered, target].forEach((element, position) => {
        element.style.zIndex = String(base + position + 1);
    });
}

function registerPageScript(init: (signal: AbortSignal) => void): void {
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

function rovingFocus(buttons: NodeListOf<HTMLButtonElement>, signal?: AbortSignal): void {
    const all = Array.from(buttons);

    all.forEach((button, index) => {
        button.addEventListener('keydown', event => handleRovingKeydown(event, all, index), { signal });
    });
}

function setAvatarImage(image: HTMLImageElement | null, avatar: string): void {
    if (!image) return;

    if (avatar.length === 0) image.removeAttribute('src');
    else image.src = avatar;

    image.hidden = avatar.length === 0;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
    if (!element) return;

    element.hidden = hidden;
}

function setMessage(element: HTMLElement | null, message: string): void {
    if (!element) return;

    element.textContent = message;
    element.toggleAttribute('hidden', message.length === 0);
}

function setPending(control: HTMLButtonElement | null, pending: boolean): void {
    if (!control) return;

    control.disabled = pending;

    if (pending) control.setAttribute('aria-busy', 'true');
    else control.removeAttribute('aria-busy');
}

function setProductImage(image: HTMLImageElement | null, sources: ImageSources, item: CartItem): void {
    if (!image) return;

    const source = sources[item.image];

    if (source) image.src = source;
    else image.removeAttribute('src');

    image.alt = source ? `${item.title} \u2014 ${formatVariant(item)}` : '';
    image.hidden = !source;
}

function setText(element: Element | null, value: string): void {
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

function toAustinIso(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone: 'America/Chicago',
        year: 'numeric',
    });

    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));

    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));

    const offsetMinutes = Math.round((local - date.getTime()) / MILLISECONDS_PER_MINUTE);

    const magnitude = Math.abs(offsetMinutes);
    const sign = offsetMinutes < 0 ? '-' : '+';

    const hours = String(Math.floor(magnitude / MINUTES_PER_HOUR)).padStart(2, '0');
    const minutes = String(magnitude % MINUTES_PER_HOUR).padStart(2, '0');

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${hours}:${minutes}`;
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

function toCalendarEvent(entry: CollectionEntry<'events'>) {
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

function toCatalog(products: CollectionEntry<'products'>[]): CatalogEntry[] {
    return products.map(product => ({
        priceCents: product.data.priceCents,
        sku: product.data.sku,
        slug: product.id,
        stock: product.data.stock,
        title: product.data.title,
    }));
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function toLevel(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : fallback;
}

function toProducerRecord(producer: CollectionEntry<'producers'>): ProducerRecord {
    return {
        avatar: producer.data.avatar ?? null,
        bio: producer.data.bio,
        featured: producer.data.featured,
        genres: producer.data.genres,
        id: producer.id,
        joined: toIsoDate(producer.data.joined),
        links: producer.data.links,
        location: producer.data.location,
        name: producer.data.name,
        roles: producer.data.roles,
        tracks: producer.data.tracks,
    };
}

export {
    delay,
    describeCartIssue,
    formatBytes,
    formatCalendarDay,
    formatCalendarMonth,
    formatDate,
    formatDateStamp,
    formatDuration,
    formatPrice,
    formatProds,
    formatTime,
    formatTimeRange,
    formatVariant,
    formatWeekday,
    getInitials,
    getProgram,
    getStanding,
    getStockLabel,
    initFilterGroup,
    initPanelResize,
    initSearchField,
    isTopFloatWindow,
    mergeAssets,
    mergeCalendar,
    parseCatalog,
    parseImageSources,
    pickTileColor,
    raiseWindow,
    registerPageScript,
    rovingFocus,
    setAvatarImage,
    setHidden,
    setMessage,
    setPending,
    setProductImage,
    setText,
    toAustinIso,
    toCatalog,
    toIsoDate,
    toProducerRecord,
};

export type { FilterGroupOptions, PanelResizeOptions, ProgramEvent, SearchFieldOptions };
