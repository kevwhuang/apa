import { DEMO_CARDS, MOCK_LATENCY_MS, ORDER_ID, STORAGE } from '@lib/constants';
import { clear, getItems, totals } from '@lib/store';
import { createStore } from '@lib/state';
import { delay } from '@lib/utils';
import { getSession, updateSession } from '@lib/session';

const MESSAGES: Record<PaymentErrorCode, string> = {
    'card-declined': 'That card was declined. Try the approved demo number instead.',
    'cart-changed': 'Your cart changed while you were checking out. Review it and try again.',
    'empty-cart': 'There is nothing in your cart.',
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

export function getLastOrder(): Order | null {
    return store.get();
}

export function isDemoCardNumber(value: string): boolean {
    return Object.values(DEMO_CARDS).some(card => normalizeCardNumber(card) === normalizeCardNumber(value));
}

function matchesCart(items: CartItem[]) {
    const live = getItems();

    if (live.length !== items.length) return false;

    return live.every((item, index) => item.color === items[index].color
        && item.priceCents === items[index].priceCents
        && item.productSlug === items[index].productSlug
        && item.quantity === items[index].quantity
        && item.size === items[index].size);
}

function normalizeCardNumber(value: string) {
    return value.replace(/\D/g, '');
}

function normalizeOrder(value: Order | null) {
    if (typeof value !== 'object' || value === null) return null;
    if (typeof value.id !== 'string' || value.id.length === 0) return null;
    if (typeof value.totals !== 'object' || value.totals === null) return null;
    if (!Array.isArray(value.items)) return null;

    return {
        email: String(value.email ?? ''),
        id: value.id,
        items: value.items,
        placedAt: Number(value.placedAt) || 0,
        totals: value.totals,
    };
}

export async function placeOrder(input: OrderInput): Promise<OrderResult> {
    await delay(MOCK_LATENCY_MS);

    if (input.items.length === 0) return reject('empty-cart');
    if (!matchesCart(input.items)) return reject('cart-changed');
    if (normalizeCardNumber(input.cardNumber) !== normalizeCardNumber(DEMO_CARDS.approved)) return reject('card-declined');

    const session = getSession();
    const prodsApplied = Math.min(Math.max(0, Math.trunc(input.prodsApplied) || 0), session?.prods ?? 0);

    const order: Order = {
        email: input.email,
        id: createOrderId(),
        items: input.items,
        placedAt: Date.now(),
        totals: totals(input.items, prodsApplied),
    };

    store.set(order);
    clear();

    if (session && prodsApplied > 0) await updateSession({ prods: session.prods - prodsApplied });

    return { ok: true, order };
}

function reject(code: PaymentErrorCode) {
    return { code, message: MESSAGES[code], ok: false as const };
}
