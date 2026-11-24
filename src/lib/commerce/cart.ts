import { BASIS_POINTS_DIVISOR, CENTS_PER_DOLLAR, COMMERCE, PRODUCT_SIZES, STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';
import { isRecord } from '@lib/shared/utils';

const CATALOG_PATH = '/api/store';

const store = createStore<CartItem[]>({
    fallback: [],
    key: STORAGE.cart.key,
    normalize: normalizeItems,
    scope: STORAGE.cart.scope,
    topic: STORAGE.cart.topic,
});

function add(item: CartItem, maxQuantity: number): boolean {
    store.update((items) => {
        const next = [...items];

        const index = next.findIndex(existing => getVariantKey(existing) === getVariantKey(item));

        if (index < 0) {
            next.push({ ...item, quantity: clampQuantity(item.quantity, maxQuantity) });

            return next;
        }

        next[index] = { ...next[index], quantity: clampQuantity(next[index].quantity + item.quantity, maxQuantity) };

        return next;
    });

    return store.persisted();
}

function clampQuantity(quantity: number, maxQuantity: number = COMMERCE.maxQuantityPerItem): number {
    const ceiling = Math.max(1, Math.trunc(maxQuantity) || 1);

    return Math.min(ceiling, Math.max(1, Math.trunc(quantity) || 1));
}

function clear(): void {
    store.set([]);
}

function compareItems(left: CartItem, right: CartItem): number {
    return left.title.localeCompare(right.title)
        || (left.variation ?? '').localeCompare(right.variation ?? '')
        || getSizeRank(left.size) - getSizeRank(right.size);
}

function count(): number {
    return getItems().reduce((total, item) => total + item.quantity, 0);
}

async function fetchCatalog(snapshot: CatalogEntry[]): Promise<CatalogEntry[]> {
    let records: unknown;

    try {
        const response = await fetch(CATALOG_PATH);

        if (!response.ok) return snapshot;

        records = await response.json();
    } catch {
        return snapshot;
    }

    if (!Array.isArray(records)) return snapshot;

    const live = records.filter(isRecord);

    return snapshot.flatMap((entry) => {
        const record = live.find(candidate => candidate.id === entry.slug);

        return record ? [toLiveEntry(entry, record)] : [];
    });
}

function getItems(): CartItem[] {
    return store.get();
}

function getProdsCharge(balance: number, dueCents: number): number {
    const prods = Math.min(Math.max(0, Math.trunc(Number(balance)) || 0), toProds(dueCents));

    const remainder = dueCents - prods * CENTS_PER_DOLLAR;

    return prods > 0 && remainder > 0 && remainder < COMMERCE.minChargeCents ? prods - 1 : prods;
}

function getSizeRank(size = '') {
    return PRODUCT_SIZES.findIndex(entry => entry === size);
}

function getTotals(items: CartItem[], prodsApplied = 0, discountBasisPoints = 0): CartTotals {
    const subtotal = items.reduce((total, item) => total + item.priceCents * item.quantity, 0);

    const promoCents = Math.round(subtotal * discountBasisPoints / BASIS_POINTS_DIVISOR);

    const taxCents = Math.round((subtotal - promoCents) * COMMERCE.taxBasisPoints / BASIS_POINTS_DIVISOR);

    const dueCents = subtotal - promoCents + taxCents;

    const prodsCents = Math.min(Math.max(0, Math.trunc(Number(prodsApplied)) || 0) * CENTS_PER_DOLLAR, dueCents);

    return {
        discountCents: promoCents + prodsCents,
        promoCents,
        shippingCents: 0,
        subtotalCents: subtotal,
        taxCents,
        totalCents: dueCents - prodsCents,
    };
}

function getVariantKey(item: CartItem) {
    return `${item.productSlug}|${item.size ?? ''}|${item.variation ?? ''}`;
}

function isCartItem(item: unknown): item is CartItem {
    return typeof item === 'object' && item !== null && 'productSlug' in item && typeof item.productSlug === 'string';
}

function normalizeItems(items: CartItem[]) {
    if (!Array.isArray(items)) return [];

    return items
        .filter(isCartItem)
        .map(item => ({
            image: String(item.image ?? ''),
            priceCents: Number(item.priceCents) || 0,
            productSlug: item.productSlug,
            quantity: clampQuantity(Number(item.quantity), COMMERCE.maxQuantityPerItem),
            size: typeof item.size === 'string' ? item.size : undefined,
            sku: String(item.sku ?? ''),
            title: String(item.title ?? ''),
            variation: typeof item.variation === 'string' ? item.variation : undefined,
        }))
        .sort(compareItems);
}

function onCartChange(callback: (items: CartItem[]) => void): () => void {
    const unsubscribe = store.onChange(callback);

    if (typeof window === 'undefined') return unsubscribe;

    const controller = new AbortController();

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE.cart.key || event.key === null) callback(getItems());
    }, { signal: controller.signal });

    return () => {
        controller.abort();
        unsubscribe();
    };
}

function readCount(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function reconcile(catalog: CatalogEntry[]): CartIssue[] {
    const entries = new Map(catalog.map(entry => [entry.slug, entry]));
    const issues: CartIssue[] = [];
    const items = getItems();
    const next: CartItem[] = [];
    const remaining = new Map(catalog.map(entry => [entry.slug, entry.stock]));

    items.forEach((item) => {
        const entry = entries.get(item.productSlug);

        const isSizeOffered = entry?.sizes.length ? entry.sizes.includes(item.size ?? '') : !item.size;
        const variation = entry?.variations.find(candidate => candidate.name === item.variation);

        if (!entry || !isSizeOffered || !variation) {
            issues.push({ kind: 'removed', title: item.title });

            return;
        }

        const stock = remaining.get(entry.slug) ?? 0;

        if (stock <= 0) {
            issues.push({ kind: 'out-of-stock', title: entry.title });

            return;
        }

        const ceiling = Math.min(stock, COMMERCE.maxQuantityPerItem);
        const reconciled = toCatalogItem(catalog, item);

        if (item.quantity > ceiling) {
            issues.push({ from: item.quantity, kind: 'quantity-reduced', title: entry.title, to: ceiling });
            reconciled.quantity = ceiling;
        }

        if (item.priceCents !== variation.priceCents) {
            issues.push({ from: item.priceCents, kind: 'price-changed', title: entry.title, to: variation.priceCents });
            reconciled.priceCents = variation.priceCents;
        }

        remaining.set(entry.slug, stock - reconciled.quantity);
        next.push(reconciled);
    });

    const isStale = next.some((line, index) => line.image !== items[index].image || line.sku !== items[index].sku);

    if (isStale || issues.length > 0) store.set(next);

    return issues;
}

function remove(index: number): boolean {
    store.update((items) => {
        const next = [...items];

        next.splice(index, 1);

        return next;
    });

    return store.persisted();
}

function setQuantity(index: number, quantity: number, maxQuantity: number): boolean {
    const items = getItems();

    if (!items[index]) return false;

    const next = [...items];

    next[index] = { ...next[index], quantity: clampQuantity(quantity, maxQuantity) };
    store.set(next);

    return store.persisted();
}

function toCatalogItem(catalog: CatalogEntry[], item: CartItem): CartItem {
    const variation = catalog
        .find(entry => entry.slug === item.productSlug)
        ?.variations.find(candidate => candidate.name === item.variation);

    return variation ? { ...item, image: variation.image, sku: variation.sku } : { ...item };
}

function toLiveEntry(entry: CatalogEntry, record: Record<string, unknown>) {
    const variations = Array.isArray(record.variations) ? record.variations.filter(isRecord) : [];

    return {
        ...entry,
        priceCents: readCount(record.priceCents, entry.priceCents),
        stock: readCount(record.stock, entry.stock),
        variations: entry.variations.flatMap((variation) => {
            const match = variations.find(candidate => candidate.name === variation.name);

            return match ? [{ ...variation, priceCents: readCount(match.priceCents, variation.priceCents) }] : [];
        }),
    };
}

function toProds(cents: number): number {
    return Math.ceil(Math.max(0, Math.trunc(Number(cents)) || 0) / CENTS_PER_DOLLAR);
}

export {
    add,
    clampQuantity,
    clear,
    compareItems,
    count,
    fetchCatalog,
    getItems,
    getProdsCharge,
    getTotals,
    onCartChange,
    reconcile,
    remove,
    setQuantity,
    toCatalogItem,
    toProds,
};
