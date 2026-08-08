import { MOCK_LATENCY_MS, ORDER_ID, STORAGE } from '@lib/shared/constants';
import { clampQuantity, clear, getItems, prodsForCents, totals } from '@lib/commerce/cart';
import { createStore } from '@lib/shared/state';
import { delay } from '@lib/shared/utils';
import { getSession, updateSession } from '@lib/account/session';

const MAX_ORDER_CENTS = 100_000_000;

const MESSAGES: Record<PaymentErrorCode, string> = {
    'cart-changed': 'Your cart changed while you were checking out. Review it and try again.',
    'empty-cart': 'There is nothing in your cart.',
    'storage-full': 'Your order was not placed \u2014 your browser storage is full. Clear some space and try again.',
};

const store = createStore<Order | null>({
    fallback: null,
    key: STORAGE.order.key,
    normalize: normalizeOrder,
    scope: STORAGE.order.scope,
    topic: STORAGE.order.topic,
});

function createOrderId() {
    const buffer = new Uint32Array(1);

    crypto.getRandomValues(buffer);

    return `${ORDER_ID.prefix}${String(buffer[0] % ORDER_ID.range).padStart(ORDER_ID.digits, '0')}`;
}

function getLastOrder(): Order | null {
    return store.get();
}

function isStored(order: Order | null) {
    return JSON.stringify(store.get()) === JSON.stringify(order);
}

function matchesCart(items: CartItem[]) {
    const live = getItems();

    if (live.length !== items.length) return false;

    return live.every((item, index) => item.priceCents === items[index].priceCents
        && item.productSlug === items[index].productSlug
        && item.quantity === items[index].quantity
        && item.size === items[index].size
        && item.variation === items[index].variation);
}

function normalizeCents(value: number) {
    return Math.min(MAX_ORDER_CENTS, Math.max(0, Math.trunc(Number(value)) || 0));
}

function normalizeOrder(value: Order | null) {
    if (typeof value !== 'object' || value === null) return null;
    if (typeof value.id !== 'string' || value.id.length === 0) return null;
    if (typeof value.totals !== 'object' || value.totals === null) return null;
    if (!Array.isArray(value.items)) return null;

    return {
        email: String(value.email ?? ''),
        id: value.id,
        items: value.items.map(item => ({ ...item, priceCents: normalizeCents(item.priceCents), quantity: clampQuantity(Number(item.quantity)) })),
        placedAt: Number(value.placedAt) || 0,
        totals: {
            discountCents: normalizeCents(value.totals.discountCents),
            promoCents: normalizeCents(value.totals.promoCents),
            shippingCents: normalizeCents(value.totals.shippingCents),
            subtotalCents: normalizeCents(value.totals.subtotalCents),
            taxCents: normalizeCents(value.totals.taxCents),
            totalCents: normalizeCents(value.totals.totalCents),
        },
    };
}

async function placeOrder(input: OrderInput): Promise<OrderResult> {
    await delay(MOCK_LATENCY_MS);

    if (input.items.length === 0) return reject('empty-cart');
    if (!matchesCart(input.items)) return reject('cart-changed');

    const session = getSession();

    const requested = Math.max(0, Math.trunc(input.prodsApplied) || 0);

    const prodsApplied = Math.min(requested, session?.prods ?? 0, prodsForCents(totals(input.items, 0, input.promoCode).totalCents));

    const order: Order = {
        email: input.email,
        id: createOrderId(),
        items: input.items,
        placedAt: Date.now(),
        totals: totals(input.items, prodsApplied, input.promoCode),
    };

    const stored = store.set(order);

    if (!stored || !store.persisted() || !isStored(stored)) return reject('storage-full');

    clear();

    if (session && prodsApplied > 0) await updateSession({ prods: session.prods - prodsApplied });

    return { ok: true, order: stored };
}

function reject(code: PaymentErrorCode) {
    return { code, message: MESSAGES[code], ok: false as const };
}

export { getLastOrder, placeOrder };
