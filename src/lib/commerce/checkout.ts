import { STRIPE_PUBLISHABLE_KEY } from 'astro:env/client';

import { CART_CHANGED_MESSAGE, PAYMENTS_NOT_CONFIGURED_MESSAGE, PAYMENT_FAILED_MESSAGE, PROMO_CODE_MESSAGE, STORAGE } from '@lib/shared/constants';
import { clampQuantity, clear, compareItems, getItems, getTotals, toCatalogItem } from '@lib/commerce/cart';
import { createStore } from '@lib/shared/state';
import { getAccessToken, supabase } from '@lib/shared/supabase';
import { getSession } from '@lib/account/session';
import { isRecord } from '@lib/shared/utils';
import { sendRequest } from '@lib/shared/request';

type LocalErrorCode = Exclude<PaymentErrorCode, 'rate-limited'>;

interface ItemRow {
    image: string;
    price_cents: number;
    product_slug: string;
    quantity: number;
    size: null | string;
    sku: string;
    title: string;
    variation: string;
}

interface OrderAttempt {
    body: string;
    id: string;
    isPrepaid: boolean;
    purchase: string;
    userId: string;
}

interface OrderRow {
    email: string;
    items: ItemRow[];
    number: string;
    placed_at: string;
    prods_cents: number;
    promo_cents: number;
    shipping_cents: number;
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
}

const HISTORY_LIMIT = 50;
const MAX_ORDER_CENTS = 100_000_000;
const ORDERS_PATH = '/api/orders';
const ORDER_COLUMNS = 'email, items, number, placed_at, prods_cents, promo_cents, shipping_cents, subtotal_cents, tax_cents, total_cents';
const PAYMENT_UNAVAILABLE_MESSAGE = 'The payment form did not load. Reload the page and try again.';
const PROMO_PATH = '/api/promo';
const RETURN_PATH = '/store/orders';

const MESSAGES: Record<LocalErrorCode, string> = {
    'cart-changed': CART_CHANGED_MESSAGE,
    'empty-cart': 'There is nothing in your cart.',
    'not-configured': PAYMENTS_NOT_CONFIGURED_MESSAGE,
    'payment-failed': PAYMENT_FAILED_MESSAGE,
    'payment-unavailable': PAYMENT_UNAVAILABLE_MESSAGE,
    'unavailable': 'Your order was not placed because the store could not be reached. Try again.',
};

const store = createStore<Order | null>({
    fallback: null,
    key: STORAGE.order.key,
    normalize: normalizeOrder,
    scope: STORAGE.order.scope,
    topic: STORAGE.order.topic,
});

let unanswered: OrderAttempt | undefined;

async function checkPromo(code: string): Promise<PromoResult> {
    const result = await sendRequest(PROMO_PATH, { body: { code }, method: 'POST' });

    if (!result.ok) return result;

    const { promo } = result.data;

    if (!isRecord(promo) || typeof promo.code !== 'string' || typeof promo.discountBasisPoints !== 'number') {
        return { code: 'rejected', message: PROMO_CODE_MESSAGE, ok: false };
    }

    return { ok: true, promo: { code: promo.code, discountBasisPoints: promo.discountBasisPoints } };
}

async function loadOrderStatus(number: string): Promise<null | string> {
    const { data, error } = await supabase.from('orders').select('status').eq('number', number).maybeSingle();

    if (error || !isRecord(data) || typeof data.status !== 'string') return null;

    return data.status;
}

async function loadOrders(userId: string): Promise<Order[] | null> {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('status', 'paid')
        .eq('user_id', userId)
        .order('placed_at', { ascending: false })
        .limit(HISTORY_LIMIT);

    if (error) return null;

    const rows: OrderRow[] = data;

    return rows.map(toOrder);
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

function normalizeCents(value: unknown) {
    return Math.min(MAX_ORDER_CENTS, Math.max(0, Math.trunc(Number(value)) || 0));
}

function normalizeItem(item: Record<string, unknown>) {
    return {
        image: String(item.image ?? ''),
        priceCents: normalizeCents(item.priceCents),
        productSlug: String(item.productSlug ?? ''),
        quantity: clampQuantity(Number(item.quantity)),
        size: typeof item.size === 'string' ? item.size : undefined,
        sku: String(item.sku ?? ''),
        title: String(item.title ?? ''),
        variation: typeof item.variation === 'string' ? item.variation : undefined,
    };
}

function normalizeOrder(value: unknown) {
    if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.totals)) return null;
    if (typeof value.id !== 'string' || value.id.length === 0) return null;

    return {
        account: String(value.account ?? ''),
        email: String(value.email ?? ''),
        id: value.id,
        items: value.items
            .filter(isRecord)
            .map(normalizeItem)
            .sort(compareItems),
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
    if (input.items.length === 0) return reject('empty-cart');
    if (!matchesCart(input.items)) return reject('cart-changed');

    const promoCode = input.promo?.code ?? '';
    const session = getSession();
    const totals = getTotals(input.items, input.prodsApplied, input.promo?.discountBasisPoints);

    const purchase = JSON.stringify({ email: input.email, items: input.items.map(toLine), promoCode, shipping: input.shipping });

    if (session && unanswered?.isPrepaid && unanswered.purchase === purchase && unanswered.userId === session.id) {
        const { data, error } = await supabase.from('orders').select(ORDER_COLUMNS).eq('request_id', unanswered.id).maybeSingle();

        if (error) return reject('unavailable');

        if (data) {
            const row: OrderRow = data;

            const order = { ...toOrder(row), account: session.email };

            unanswered = undefined;
            store.set(order);
            clear();

            return { ok: true, order };
        }
    }

    if (totals.totalCents > 0) {
        if (!input.payment) return reject(STRIPE_PUBLISHABLE_KEY ? 'payment-unavailable' : 'not-configured');

        const submitted = await input.payment.submit();

        if (!submitted.ok) return { code: 'payment-failed', message: submitted.message, ok: false };
    }

    const body = {
        email: input.email,
        items: input.items.map(toLine),
        prodsApplied: input.prodsApplied,
        promoCode,
        shipping: input.shipping,
        totalCents: totals.totalCents,
    };

    const userId = getSession()?.id ?? '';

    const serialized = JSON.stringify(body);

    const requestId = unanswered?.body === serialized && unanswered.userId === userId ? unanswered.id : crypto.randomUUID();

    const token = await getAccessToken();

    unanswered = { body: serialized, id: requestId, isPrepaid: totals.totalCents === 0, purchase, userId };

    const result = await sendRequest(ORDERS_PATH, { body: { ...body, requestId }, method: 'POST', token });

    if (!result.ok) {
        if (result.code === 'conflict') return reject('cart-changed');
        if (result.code === 'network') return reject('unavailable');

        return {
            code: result.code === 'not-configured' || result.code === 'rate-limited' ? result.code : 'unavailable',
            message: result.message,
            ok: false,
        };
    }

    const { clientSecret } = result.data;
    const order = normalizeOrder(result.data.order);

    if (!order) return reject('unavailable');

    unanswered = undefined;

    if (input.payment && totals.totalCents > 0) {
        if (typeof clientSecret !== 'string') return reject('unavailable');

        const confirmed = await input.payment.confirm(clientSecret, RETURN_PATH);

        if (!confirmed.ok) return { code: 'payment-failed', message: confirmed.message, ok: false };
    }

    store.set(order);
    clear();

    return { ok: true, order };
}

function reconcileOrder(catalog: CatalogEntry[]): Order | null {
    const order = store.get();

    if (!order) return null;

    const items = order.items.map(item => toCatalogItem(catalog, item));

    const isStale = items.some((line, index) => line.image !== order.items[index].image || line.sku !== order.items[index].sku);

    return isStale ? store.set({ ...order, items }) : order;
}

function reject(code: LocalErrorCode) {
    return { code, message: MESSAGES[code], ok: false as const };
}

function toItem(row: ItemRow) {
    return {
        image: row.image,
        priceCents: row.price_cents,
        productSlug: row.product_slug,
        quantity: row.quantity,
        size: row.size ?? undefined,
        sku: row.sku,
        title: row.title,
        variation: row.variation,
    };
}

function toLine(item: CartItem) {
    return {
        priceCents: item.priceCents,
        productSlug: item.productSlug,
        quantity: item.quantity,
        size: item.size,
        variation: item.variation,
    };
}

function toOrder(row: OrderRow) {
    return {
        account: '',
        email: row.email,
        id: row.number,
        items: row.items
            .map(toItem)
            .sort(compareItems),
        placedAt: Date.parse(row.placed_at),
        totals: {
            discountCents: row.promo_cents + row.prods_cents,
            promoCents: row.promo_cents,
            shippingCents: row.shipping_cents,
            subtotalCents: row.subtotal_cents,
            taxCents: row.tax_cents,
            totalCents: row.total_cents,
        },
    };
}

export { PAYMENT_UNAVAILABLE_MESSAGE, checkPromo, loadOrderStatus, loadOrders, placeOrder, reconcileOrder };
