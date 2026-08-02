import { BASIS_POINTS_DIVISOR, CENTS_PER_DOLLAR, COMMERCE, STORAGE } from '@lib/constants';
import { createStore } from '@lib/state';

const SEED_ITEMS: CartItem[] = [
    { color: 'Bone', image: 'tick-tee-1', priceCents: 3_500, productSlug: 'tick-tee', quantity: 1, size: 'M', title: 'Tick Tee' },
    { image: 'stickers-1', priceCents: 800, productSlug: 'sticker-pack', quantity: 2, title: 'Sticker Pack' },
];

const SEED_MARKER_KEY = 'apa.cart-seeded';

const cart = createStore<CartItem[]>({
    fallback: [],
    key: STORAGE.cart.key,
    normalize: normalizeItems,
    scope: STORAGE.cart.scope,
    topic: STORAGE.cart.topic,
});

export function add(item: CartItem, maxQuantity: number = COMMERCE.maxQuantityPerItem): void {
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

function clampQuantity(quantity: number, maxQuantity: number): number {
    const ceiling = Math.max(1, Math.trunc(maxQuantity) || 1);

    return Math.min(ceiling, Math.max(1, Math.trunc(quantity) || 1));
}

export function clear(): void {
    cart.set([]);
}

export function count(items = getItems()): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}

export function getItems(): CartItem[] {
    return cart.get();
}

function isCartItem(item: unknown): item is CartItem {
    return typeof item === 'object' && item !== null && 'productSlug' in item && typeof item.productSlug === 'string';
}

function normalizeItems(items: CartItem[]): CartItem[] {
    if (!Array.isArray(items)) return [];

    return items.filter(isCartItem).map(item => ({
        ...item,
        priceCents: Number(item.priceCents) || 0,
        quantity: Math.max(1, Math.trunc(Number(item.quantity)) || 1),
    }));
}

export function onChange(callback: (items: CartItem[]) => void): () => void {
    return cart.onChange(callback);
}

export function reconcile(catalog: CatalogEntry[], items = getItems()): CartIssue[] {
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

export function remove(index: number): void {
    cart.update((items) => {
        const next = [...items];

        next.splice(index, 1);

        return next;
    });
}

export function seedCart(): void {
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

export function setQuantity(index: number, quantity: number, maxQuantity: number = COMMERCE.maxQuantityPerItem): void {
    const items = getItems();

    if (!items[index]) return;

    const next = [...items];

    next[index] = { ...next[index], quantity: clampQuantity(quantity, maxQuantity) };

    cart.set(next);
}

export function subtotalCents(items = getItems()): number {
    return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

export function totals(items = getItems(), prodsApplied = 0): CartTotals {
    const subtotal = subtotalCents(items);
    const credit = Math.max(0, Math.trunc(prodsApplied) || 0) * CENTS_PER_DOLLAR;
    const discountCents = Math.min(credit, subtotal);
    const taxCents = Math.round((subtotal - discountCents) * COMMERCE.taxBasisPoints / BASIS_POINTS_DIVISOR);
    const shippingCents = subtotal === 0 || subtotal >= COMMERCE.freeShippingThresholdCents ? 0 : COMMERCE.shippingFlatCents;

    return {
        discountCents,
        shippingCents,
        subtotalCents: subtotal,
        taxCents,
        totalCents: subtotal - discountCents + taxCents + shippingCents,
    };
}

function variantKey(item: CartItem): string {
    return `${item.productSlug}|${item.size ?? ''}|${item.color ?? ''}`;
}
