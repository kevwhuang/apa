import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE, CENTS_PER_DOLLAR, EVENT_PROGRAMS, PALETTE, ROLES } from '@lib/shared/constants';
import { revealTarget } from '@lib/motion/entrances';

import type { CollectionEntry } from 'astro:content';

interface Calendar {
    past: CalendarEvent[];
    upcoming: CalendarEvent[];
}

interface FilterGroupOptions {
    cards: NodeListOf<HTMLElement>;
    emptyElement?: HTMLElement | null;
    filters: FilterOptions[];
    searchElement?: HTMLInputElement | null;
    signal: AbortSignal;
    status: (shown: number, total: number, isFiltered: boolean, query: string) => string;
    statusElement: HTMLElement | null;
}

interface FilterOptions {
    buttons: NodeListOf<HTMLButtonElement>;
    dataKey: string;
    matches: (card: HTMLElement, active: Set<string>) => boolean;
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

const CLOCK_DIGITS = 2;
const DETAIL_SEPARATOR = ' \u00b7 ';
const EMPTY_TILE_COLOR: TileColor = { background: 'var(--color-ink)', text: 'var(--color-text-inverse-secondary)' };
const ENTRY_PAD = 2;
const FLOAT_WINDOW_TOPIC = 'apa:float-window';
const ISO_DATE_LENGTH = 10;
const MAX_INITIALS = 2;
const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const PANEL_NARROW_VIEWPORT = 480;
const PANEL_RESIZE_STEP = 16;
const PANEL_WIDE_DIVISOR = 2;
const PANEL_WIDE_VIEWPORT = 1_024;
const PARAGRAPH_SEPARATOR = '\n\n';
const SECONDS_PER_MINUTE = 60;
const SLOW_CORE_COUNT = 4;
const WINNER_MEDALS: Record<string, string | undefined> = { 'First place': '\u{1F947}', 'Second place': '\u{1F948}', 'Third place': '\u{1F949}' };

const panelWidths = new Map<string, number>();

function claimFloatWindow(panel: HTMLElement): void {
    window.dispatchEvent(new CustomEvent(FLOAT_WINDOW_TOPIC, { detail: { panel } }));
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function describeCartIssue(issue: CartIssue): string {
    if (issue.kind === 'out-of-stock') return `${issue.title} sold out and was removed.`;
    if (issue.kind === 'price-changed') return `${issue.title} is now ${formatPrice(issue.to ?? 0)}, previously ${formatPrice(issue.from ?? 0)}.`;
    if (issue.kind === 'quantity-reduced') return `${issue.title} was reduced to ${issue.to ?? 0}. That is all we have left.`;

    return `${issue.title} is no longer in the store and was removed.`;
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

function formatCredit(title: string): string {
    return title.split(DETAIL_SEPARATOR).slice(1).join(DETAIL_SEPARATOR);
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

    return `${minutes}:${String(remainder).padStart(CLOCK_DIGITS, '0')}`;
}

function formatEntry(value: number): string {
    return String(value).padStart(ENTRY_PAD, '0');
}

function formatPrice(cents: number): string {
    return `$${(cents / CENTS_PER_DOLLAR).toFixed(2)}`;
}

function formatProds(prods: number): string {
    const count = Math.max(0, Math.trunc(prods) || 0);

    return count === 1 ? '1 Prod' : `${count} Prods`;
}

function formatRole(role: string): string {
    return ROLES.find(entry => entry.id === role)?.label ?? role;
}

function formatSku(sku: string): string {
    return `SKU-${sku}`;
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

function formatVenue(location: string): string {
    return location.split(DETAIL_SEPARATOR)[0];
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    return words.slice(0, MAX_INITIALS).map(word => word.charAt(0).toUpperCase()).join('');
}

function getMaxPanelWidth(viewportWidth: number, reservedRight: number) {
    const narrowMax = PANEL_NARROW_VIEWPORT - reservedRight;
    const wideMax = PANEL_WIDE_VIEWPORT / PANEL_WIDE_DIVISOR;

    if (viewportWidth <= PANEL_NARROW_VIEWPORT) return viewportWidth - reservedRight;
    if (viewportWidth >= PANEL_WIDE_VIEWPORT) return viewportWidth / PANEL_WIDE_DIVISOR;

    const ratio = (viewportWidth - PANEL_NARROW_VIEWPORT) / (PANEL_WIDE_VIEWPORT - PANEL_NARROW_VIEWPORT);

    return narrowMax + (wideMax - narrowMax) * ratio;
}

function getProductHref(catalog: CatalogEntry[], item: CartItem) {
    const sku = catalog.find(entry => entry.slug === item.productSlug)?.sku;

    if (!sku) return '';

    if (!item.variation) return `/store/${sku}`;

    return `/store/${sku}?variation=${encodeURIComponent(item.variation.toLowerCase())}`;
}

function getProgram(type: EventType): EventProgram {
    return EVENT_PROGRAMS[type];
}

function getStockLabel(stock: number): string {
    if (stock === 0) return 'Sold out';

    return '';
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
    const { cards, emptyElement, filters, searchElement, signal, status, statusElement } = options;

    const groups = filters.map(filter => ({ ...filter, active: new Set<string>() }));

    function apply(shouldReveal: boolean) {
        const query = (searchElement?.value ?? '').trim();

        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

        let shown = 0;

        groups.forEach(({ active, buttons, dataKey }) => paintFilterButtons(buttons, dataKey, active));

        cards.forEach((card) => {
            const haystack = card.dataset.search ?? '';

            const isMatch = groups.every(({ active, matches }) => !active.size || matches(card, active))
                && tokens.every(token => haystack.includes(token));

            if (isMatch) shown += 1;

            card.classList.toggle('hidden', !isMatch);

            if (isMatch && shouldReveal) revealTarget(card);
        });

        if (emptyElement) {
            setText(emptyElement.querySelector('[data-search-echo]'), query);
            setHidden(emptyElement.querySelector<HTMLElement>('[data-empty-query]'), !query);
            setHidden(emptyElement.querySelector<HTMLElement>('[data-empty-filters]'), Boolean(query));
            setHidden(emptyElement, shown > 0);
        }

        setText(statusElement, status(shown, cards.length, groups.some(({ active }) => active.size > 0), query));
    }

    function handleClick(active: Set<string>, value: string) {
        if (!value) active.clear();
        else if (active.has(value)) active.delete(value);
        else active.add(value);

        apply(true);
    }

    apply(false);

    groups.forEach(({ active, buttons, dataKey }) => {
        initRovingFocus(buttons, signal);

        buttons.forEach((button) => {
            button.addEventListener('click', () => handleClick(active, button.dataset[dataKey] ?? ''), { signal });
        });
    });

    searchElement?.addEventListener('input', () => apply(true), { signal });
}

function initPanelResize(options: PanelResizeOptions): void {
    const { handle, label, minWidth, panel, property, reservedRight, signal } = options;

    let pointer: number | undefined;

    function apply(width: number) {
        const { max, min } = getBounds();

        const next = Math.round(Math.min(Math.max(width, min), max));

        handle.setAttribute('aria-valuemax', String(Math.round(max)));
        handle.setAttribute('aria-valuemin', String(Math.round(min)));
        handle.setAttribute('aria-valuenow', String(next));
        panel.style.setProperty(property, `${next}px`);
        panelWidths.set(property, next);
    }

    function getBounds() {
        const min = Math.min(minWidth, Number.parseFloat(getComputedStyle(panel).maxWidth));

        return { max: Math.max(getMaxPanelWidth(window.innerWidth, reservedRight), min), min };
    }

    function getCurrentWidth() {
        const stored = panelWidths.get(property);

        if (stored !== undefined) return stored;

        const measured = panel.getBoundingClientRect().width;

        return measured > 0 ? measured : minWidth;
    }

    function getKeyWidth(key: string) {
        const { max, min } = getBounds();

        if (key === 'ArrowLeft') return getCurrentWidth() + PANEL_RESIZE_STEP;
        if (key === 'ArrowRight') return getCurrentWidth() - PANEL_RESIZE_STEP;
        if (key === 'End') return max;
        if (key === 'Home') return min;

        return undefined;
    }

    function handleKeydown(event: KeyboardEvent) {
        const next = getKeyWidth(event.key);

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
        apply(getCurrentWidth());
    }

    apply(getCurrentWidth());
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

function initRovingFocus(buttons: NodeListOf<HTMLButtonElement>, signal?: AbortSignal): void {
    const all = Array.from(buttons);

    all.forEach((button, index) => {
        button.addEventListener('keydown', event => handleRovingKeydown(event, all, index), { signal });
    });
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
        const isEmpty = input.value.length === 0;

        clearElements.forEach((button) => {
            button.hidden = isEmpty;
        });
    }

    sync(searchElement);
    searchElement.addEventListener('input', () => sync(searchElement), { signal });

    clearElements.forEach((button) => {
        button.addEventListener('click', () => handleClear(searchElement), { signal });
    });
}

function isOutsideBox(event: MouseEvent, box: Element | null): boolean {
    if (!box || event.target !== event.currentTarget) return false;

    const { bottom, left, right, top } = box.getBoundingClientRect();

    return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

function isSlowDevice(): boolean {
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };

    return (navigator.hardwareConcurrency ?? 0) <= SLOW_CORE_COUNT || connection?.saveData === true;
}

function isUpcoming(end: Date): boolean {
    return end.getTime() >= Date.now();
}

function mergeAssets(downloads: CollectionEntry<'downloads'>[], docs: CollectionEntry<'docs'>[]): CollectionEntry<'downloads'>[] {
    return downloads.map((entry) => {
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
    });
}

function mergeCalendar(events: CollectionEntry<'events'>[], bashEditions: CollectionEntry<'bash'>[]): Calendar {
    const merged = [...events.map(toCalendarEvent), ...bashEditions.map(toCalendarBashEvent)];

    return {
        past: merged
            .filter(event => !isUpcoming(event.end))
            .sort((a, b) => +b.date - +a.date),
        upcoming: merged
            .filter(event => isUpcoming(event.end))
            .sort((a, b) => +a.date - +b.date),
    };
}

function onFloatWindowClaim(panel: HTMLElement, close: () => void, signal: AbortSignal): void {
    window.addEventListener(FLOAT_WINDOW_TOPIC, (event) => {
        if (event.detail.panel !== panel && panel.checkVisibility()) close();
    }, { signal });
}

function paintFilterButtons(buttons: NodeListOf<HTMLButtonElement>, key: string, active: Set<string>): void {
    buttons.forEach((button) => {
        const value = button.dataset[key] ?? '';

        const isActive = value ? active.has(value) : !active.size;

        if (button.classList.contains('is-active') === isActive) return;

        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
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

function pickTileColor(seed: string): TileColor {
    if (seed.length === 0) return EMPTY_TILE_COLOR;

    const total = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);

    return PALETTE[total % PALETTE.length];
}

function preventNavigation(event: DragEvent): void {
    event.preventDefault();
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

function setAvatarImage(image: HTMLImageElement | null, avatar: string): void {
    if (!image) return;

    if (avatar.length === 0) image.removeAttribute('src');
    else image.src = avatar;

    image.hidden = avatar.length === 0;
}

function setHidden(element: HTMLElement | null, isHidden: boolean): void {
    if (!element) return;

    element.hidden = isHidden;
}

function setMessage(element: HTMLElement | null, message: string): void {
    if (!element) return;

    element.textContent = message;
    element.toggleAttribute('hidden', message.length === 0);
}

function setPending(control: HTMLButtonElement | null, isPending: boolean): void {
    if (!control) return;

    control.disabled = isPending;

    if (isPending) control.setAttribute('aria-busy', 'true');
    else control.removeAttribute('aria-busy');
}

function setProductImage(image: HTMLImageElement | null, sources: ImageSources, item: CartItem): void {
    if (!image) return;

    const source = sources[item.image];

    if (source) image.src = source;
    else image.removeAttribute('src');

    image.hidden = !source;
}

function setText(element: Element | null, value: string): void {
    if (element) element.textContent = value;
}

function setTitleLink(element: Element | null, catalog: CatalogEntry[], item: CartItem, text: string): void {
    if (!(element instanceof HTMLAnchorElement)) return;

    const href = getProductHref(catalog, item);

    if (href.length === 0) {
        element.replaceWith(text);

        return;
    }

    element.href = href;
    setText(element, text);
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

    const local = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
    );

    const offsetMinutes = Math.round((local - date.getTime()) / MILLISECONDS_PER_MINUTE);

    const magnitude = Math.abs(offsetMinutes);
    const sign = offsetMinutes < 0 ? '-' : '+';

    const hours = String(Math.floor(magnitude / MINUTES_PER_HOUR)).padStart(CLOCK_DIGITS, '0');
    const minutes = String(magnitude % MINUTES_PER_HOUR).padStart(CLOCK_DIGITS, '0');

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${hours}:${minutes}`;
}

function toCalendarBashEvent(entry: CollectionEntry<'bash'>) {
    return {
        date: entry.data.date,
        end: entry.data.end,
        excerpt: entry.data.recap,
        id: entry.id,
        location: entry.data.location,
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
        title: entry.data.title,
        type: entry.data.type,
    };
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function toProducerRecord(producer: CollectionEntry<'producers'>): ProducerRecord {
    return {
        bio: producer.data.bio,
        featured: producer.data.featured,
        genres: producer.data.genres,
        id: producer.data.producerId,
        joined: toIsoDate(producer.data.joined),
        links: producer.data.links,
        location: producer.data.location,
        name: producer.data.name,
        roles: producer.data.roles,
        tracks: producer.data.tracks,
    };
}

function toProgramBashCard(entry: CollectionEntry<'bash'>) {
    const { sponsors, winners } = entry.data;

    return {
        date: entry.data.date,
        end: entry.data.end,
        heading: entry.data.edition,
        location: entry.data.location,
        notes: [
            {
                label: sponsors.length > 1 ? 'Sponsors' : 'Sponsor',
                paragraphs: sponsors.flatMap(({ description, name }) => description?.split(PARAGRAPH_SEPARATOR) ?? [name]),
            },
            {
                label: winners.length > 1 ? 'Winners' : 'Winner',
                paragraphs: winners.length > 0
                    ? [entry.data.recap, ...winners.map(({ name, place }) => `${WINNER_MEDALS[place] ?? place} ${name}`)]
                    : [],
            },
        ].filter(note => note.paragraphs.length > 0),
        text: entry.data.prompt,
    };
}

function toProgramCard(entry: CollectionEntry<'events'>) {
    const bios = entry.data.speakers.flatMap(({ bio }) => (bio ? [bio] : []));

    return {
        credit: entry.data.workshop ? formatCredit(entry.data.title) : '',
        date: entry.data.date,
        end: entry.data.end,
        heading: entry.data.workshop ?? entry.data.title,
        location: entry.data.location,
        notes: [
            {
                label: bios.length > 1 ? 'Presenters' : 'Presenter',
                paragraphs: bios,
            },
            {
                label: 'Workshop',
                paragraphs: entry.data.description && entry.data.workshop ? entry.data.description.split(PARAGRAPH_SEPARATOR) : [],
            },
        ].filter(note => note.paragraphs.length > 0),
        text: entry.data.excerpt,
    };
}

function toRoster(producers: CollectionEntry<'producers'>[]): CollectionEntry<'producers'>[] {
    if (new Set(producers.map(producer => producer.data.producerId)).size !== producers.length) throw new Error('Each producer needs its own ID.');

    return producers;
}

export {
    claimFloatWindow,
    delay,
    describeCartIssue,
    formatBytes,
    formatCalendarDay,
    formatCalendarMonth,
    formatCredit,
    formatDateStamp,
    formatDuration,
    formatEntry,
    formatPrice,
    formatProds,
    formatRole,
    formatSku,
    formatTime,
    formatTimeRange,
    formatVariant,
    formatVenue,
    getInitials,
    getProgram,
    getStockLabel,
    initFilterGroup,
    initPanelResize,
    initRovingFocus,
    initSearchField,
    isOutsideBox,
    isSlowDevice,
    isUpcoming,
    mergeAssets,
    mergeCalendar,
    onFloatWindowClaim,
    parseCatalog,
    parseImageSources,
    pickTileColor,
    preventNavigation,
    registerPageScript,
    setAvatarImage,
    setHidden,
    setMessage,
    setPending,
    setProductImage,
    setText,
    setTitleLink,
    toAustinIso,
    toIsoDate,
    toProducerRecord,
    toProgramBashCard,
    toProgramCard,
    toRoster,
};
