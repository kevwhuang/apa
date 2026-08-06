import { BASIS_POINTS_DIVISOR, CENTS_PER_DOLLAR, COMMERCE, STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const SEED_ITEMS: CartItem[] = [
    { image: '725841936_bone', priceCents: 3_500, productSlug: 'tick-tee', quantity: 1, size: 'M', title: 'Tick Tee', variation: 'Bone' },
    { image: '639158247_assorted', priceCents: 800, productSlug: 'sticker-pack', quantity: 2, title: 'Sticker Pack', variation: 'Assorted' },
];

const SEED_MARKER_KEY = 'apa.cart-seeded';

const cart = createStore<CartItem[]>({
    fallback: [],
    key: STORAGE.cart.key,
    normalize: normalizeItems,
    scope: STORAGE.cart.scope,
    topic: STORAGE.cart.topic,
});

function add(item: CartItem, maxQuantity: number = COMMERCE.maxQuantityPerItem): void {
    cart.update((items) => {
        const next = [...items];

        const index = next.findIndex(existing => variantKey(existing) === variantKey(item));

        if (index < 0) {
            next.push({ ...item, quantity: clampQuantity(item.quantity, maxQuantity) });

            return next;
        }

        next[index] = { ...next[index], quantity: clampQuantity(next[index].quantity + item.quantity, maxQuantity) };

        return next;
    });
}

function clampQuantity(quantity: number, maxQuantity: number = COMMERCE.maxQuantityPerItem): number {
    const ceiling = Math.max(1, Math.trunc(maxQuantity) || 1);

    return Math.min(ceiling, Math.max(1, Math.trunc(quantity) || 1));
}

function clear(): void {
    cart.set([]);
}

function compareItems(left: CartItem, right: CartItem): number {
    return left.title.localeCompare(right.title) || (left.variation ?? '').localeCompare(right.variation ?? '') || (left.size ?? '').localeCompare(right.size ?? '');
}

function count(items = getItems()): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}

function getItems(): CartItem[] {
    return cart.get();
}

function isCartItem(item: unknown): item is CartItem {
    return typeof item === 'object' && item !== null && 'productSlug' in item && typeof item.productSlug === 'string';
}

function isPromoCode(code: string): boolean {
    return code.trim().toUpperCase() === COMMERCE.discountCode;
}

function normalizeItems(items: CartItem[]): CartItem[] {
    if (!Array.isArray(items)) return [];

    return items.filter(isCartItem).map(item => ({
        ...item,
        priceCents: Number(item.priceCents) || 0,
        quantity: clampQuantity(Number(item.quantity), COMMERCE.maxQuantityPerItem),
        title: String(item.title ?? ''),
    })).sort(compareItems);
}

function onChange(callback: (items: CartItem[]) => void): () => void {
    return cart.onChange(callback);
}

function photoKey(productSlug: string, variation = ''): string {
    return `${productSlug}|${variation}`;
}

function prodsForCents(cents: number): number {
    return Math.ceil(Math.max(0, Math.trunc(Number(cents)) || 0) / CENTS_PER_DOLLAR);
}

function prodsToCents(prods: number): number {
    return Math.max(0, Math.trunc(Number(prods)) || 0) * CENTS_PER_DOLLAR;
}

function reconcile(catalog: CatalogEntry[], items = getItems()): CartIssue[] {
    const entries = new Map(catalog.map(entry => [entry.slug, entry]));
    const issues: CartIssue[] = [];
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
        const reconciled = { ...item };

        if (item.quantity > ceiling) {
            issues.push({ from: item.quantity, kind: 'quantity-reduced', title: entry.title, to: ceiling });
            reconciled.quantity = ceiling;
        }

        if (item.priceCents !== entry.priceCents) {
            issues.push({ from: item.priceCents, kind: 'price-changed', title: entry.title, to: entry.priceCents });
            reconciled.priceCents = entry.priceCents;
        }

        next.push(reconciled);
    });

    if (issues.length > 0) cart.set(next);

    return issues;
}

function remove(index: number): void {
    cart.update((items) => {
        const next = [...items];

        next.splice(index, 1);

        return next;
    });
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

    cart.set(SEED_ITEMS.map(item => ({ ...item })));
}

function setQuantity(index: number, quantity: number, maxQuantity: number = COMMERCE.maxQuantityPerItem): void {
    const items = getItems();

    if (!items[index]) return;

    const next = [...items];

    next[index] = { ...next[index], quantity: clampQuantity(quantity, maxQuantity) };
    cart.set(next);
}

function subtotalCents(items = getItems()): number {
    return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

function totals(items = getItems(), prodsApplied = 0, promoCode = ''): CartTotals {
    const subtotal = subtotalCents(items);

    const promoCents = isPromoCode(promoCode) ? Math.round(subtotal * COMMERCE.discountBasisPoints / BASIS_POINTS_DIVISOR) : 0;

    const taxCents = Math.round((subtotal - promoCents) * COMMERCE.taxBasisPoints / BASIS_POINTS_DIVISOR);

    const dueCents = subtotal - promoCents + taxCents;

    const prodsCents = Math.min(prodsToCents(prodsApplied), dueCents);

    return {
        discountCents: promoCents + prodsCents,
        promoCents,
        shippingCents: 0,
        subtotalCents: subtotal,
        taxCents,
        totalCents: dueCents - prodsCents,
    };
}

function variantKey(item: CartItem): string {
    return `${item.productSlug}|${item.size ?? ''}|${item.variation ?? ''}`;
}

export {
    add,
    clampQuantity,
    clear,
    count,
    getItems,
    isPromoCode,
    onChange,
    photoKey,
    prodsForCents,
    prodsToCents,
    reconcile,
    remove,
    seedCart,
    setQuantity,
    subtotalCents,
    totals,
};
