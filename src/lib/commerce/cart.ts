import { BASIS_POINTS_DIVISOR, CENTS_PER_DOLLAR, COMMERCE, PRODUCT_SIZES, STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const SEED_ITEMS: CartItem[] = [
    { image: '01001_symbol', priceCents: 100, productSlug: 'alliance_sticker', quantity: 2, sku: '01001', title: 'Alliance Sticker', variation: 'Symbol' },
    { image: '00010_bone', priceCents: 3_000, productSlug: 'alliance_tee', quantity: 1, size: 'M', sku: '00010', title: 'Alliance Tee', variation: 'Bone' },
];

const SEED_MARKER_KEY = 'apa.cart-seeded';

const SEED_ROWS = SEED_ITEMS.length;

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

function getItems(): CartItem[] {
    return store.get();
}

function getSizeRank(size = '') {
    return PRODUCT_SIZES.findIndex(entry => entry === size);
}

function getTotals(items: CartItem[], prodsApplied = 0, promoCode = ''): CartTotals {
    const subtotal = items.reduce((total, item) => total + item.priceCents * item.quantity, 0);

    const promoCents = isPromoCode(promoCode) ? Math.round(subtotal * COMMERCE.discountBasisPoints / BASIS_POINTS_DIVISOR) : 0;

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

function isPromoCode(code: string): boolean {
    return code.trim().toUpperCase() === COMMERCE.discountCode;
}

function normalizeItems(items: CartItem[]) {
    if (!Array.isArray(items)) return [];

    return items.filter(isCartItem).map(item => ({
        ...item,
        priceCents: Number(item.priceCents) || 0,
        quantity: clampQuantity(Number(item.quantity), COMMERCE.maxQuantityPerItem),
        sku: String(item.sku ?? ''),
        title: String(item.title ?? ''),
    })).sort(compareItems);
}

function onCartChange(callback: (items: CartItem[]) => void): () => void {
    return store.onChange(callback);
}

function reconcile(catalog: CatalogEntry[]): CartIssue[] {
    const entries = new Map(catalog.map(entry => [entry.slug, entry]));
    const issues: CartIssue[] = [];
    const items = getItems();
    const next: CartItem[] = [];

    items.forEach((item) => {
        const entry = entries.get(item.productSlug);

        if (!entry) {
            issues.push({ kind: 'removed', title: item.title });

            return;
        }

        if (entry.stock === 0) {
            issues.push({ kind: 'out-of-stock', title: entry.title });

            return;
        }

        const ceiling = Math.min(entry.stock, COMMERCE.maxQuantityPerItem);
        const priceCents = entry.variations.find(variation => variation.name === item.variation)?.priceCents ?? entry.priceCents;
        const reconciled = toCatalogItem(catalog, item);

        if (item.quantity > ceiling) {
            issues.push({ from: item.quantity, kind: 'quantity-reduced', title: entry.title, to: ceiling });
            reconciled.quantity = ceiling;
        }

        if (item.priceCents !== priceCents) {
            issues.push({ from: item.priceCents, kind: 'price-changed', title: entry.title, to: priceCents });
            reconciled.priceCents = priceCents;
        }

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

function seedCart(): void {
    if (typeof localStorage === 'undefined') return;

    try {
        if (localStorage.getItem(SEED_MARKER_KEY) !== null) return;

        localStorage.setItem(SEED_MARKER_KEY, String(Date.now()));
    } catch {
        return;
    }

    if (getItems().length > 0) return;

    store.set(SEED_ITEMS.map(item => ({ ...item })));
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

function toProds(cents: number): number {
    return Math.ceil(Math.max(0, Math.trunc(Number(cents)) || 0) / CENTS_PER_DOLLAR);
}

export {
    SEED_ROWS,
    add,
    clampQuantity,
    clear,
    compareItems,
    count,
    getItems,
    getTotals,
    isPromoCode,
    onCartChange,
    reconcile,
    remove,
    seedCart,
    setQuantity,
    toCatalogItem,
    toProds,
};
