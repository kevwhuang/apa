import { getCollection } from 'astro:content';

import {
    CART_CHANGED_MESSAGE,
    COMMERCE,
    EMAIL_MESSAGE,
    EMAIL_PATTERN,
    FIELD_LIMITS,
    INVALID_BODY_MESSAGE,
    PAYMENTS_NOT_CONFIGURED_MESSAGE,
    PROMO_CODE_MESSAGE,
    SIGN_IN_FIRST_MESSAGE,
    US_STATES,
    ZIP_PATTERN,
} from '@lib/shared/constants';
import { compareItems, getTotals, isPromoCode, toProds } from '@lib/commerce/cart';
import { createAdminClient, getRequestToken, getRequestUser } from '@lib/server/supabase';
import { getStripe } from '@lib/server/stripe';
import { getVariationPrice, toImageKey } from '@lib/commerce/products';
import { isRecord, readText } from '@lib/shared/utils';
import { limitRequest } from '@lib/server/limiter';

import type Stripe from 'stripe';
import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';

interface OrderLine {
    priceCents: number;
    productSlug: string;
    quantity: number;
    size: string;
    variation: string;
}

interface PlacedRow {
    id: number;
    number: string;
    placed_at: string;
    superseded: string[];
}

const ADDRESS_MESSAGE = 'Enter a complete shipping address.';
const CONFLICT_CODES = ['member_unknown', 'order_conflict', 'prods_negative'] as const;
const INTENT_MESSAGE = 'Your order was not placed because the payment service did not respond. Try again.';
const MAX_LINES = 50;
const NOT_PLACED_MESSAGE = 'Your order was not placed. Try again.';
const SIGN_IN_MESSAGE = 'Sign in to pay with Prods.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isBounded(value: string, min: number, max: number) {
    return value.length >= min && value.length <= max;
}

function priceLines(lines: OrderLine[], products: CollectionEntry<'products'>[]) {
    const items: CartItem[] = [];
    const keys = new Set<string>();

    for (const line of lines) {
        const key = `${line.productSlug}|${line.size}|${line.variation}`;
        const product = products.find(entry => entry.id === line.productSlug);

        const variation = product?.data.variations.find(candidate => candidate.name === line.variation);

        if (!product || !variation || keys.has(key)) return null;

        const isSizeValid = product.data.sizes.length > 0 ? product.data.sizes.some(size => size === line.size) : line.size === '';

        if (!isSizeValid || line.priceCents !== getVariationPrice(product.data, variation)) return null;

        keys.add(key);

        items.push({
            image: toImageKey(variation),
            priceCents: line.priceCents,
            productSlug: product.id,
            quantity: line.quantity,
            size: line.size || undefined,
            sku: variation.sku,
            title: product.data.title,
            variation: variation.name,
        });
    }

    return items.sort(compareItems);
}

function readInteger(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readLines(value: unknown) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LINES) return null;

    const lines: OrderLine[] = [];

    for (const entry of value) {
        if (!isRecord(entry)) return null;

        const priceCents = readInteger(entry, 'priceCents');
        const quantity = readInteger(entry, 'quantity');

        if (priceCents === null || quantity === null || quantity < 1 || quantity > COMMERCE.maxQuantityPerItem) return null;

        lines.push({
            priceCents,
            productSlug: readText(entry, 'productSlug'),
            quantity,
            size: readText(entry, 'size'),
            variation: readText(entry, 'variation'),
        });
    }

    return lines;
}

function readShipping(value: unknown) {
    if (!isRecord(value)) return null;

    const shipping: ShippingAddress = {
        city: readText(value, 'city'),
        familyName: readText(value, 'familyName'),
        givenName: readText(value, 'givenName'),
        line1: readText(value, 'line1'),
        line2: readText(value, 'line2'),
        state: readText(value, 'state'),
        zip: readText(value, 'zip'),
    };

    const isComplete = isBounded(shipping.city, FIELD_LIMITS.cityMin, FIELD_LIMITS.name)
        && isBounded(shipping.familyName, 1, FIELD_LIMITS.name)
        && isBounded(shipping.givenName, 1, FIELD_LIMITS.name)
        && isBounded(shipping.line1, FIELD_LIMITS.addressMin, FIELD_LIMITS.address)
        && isBounded(shipping.line2, 0, FIELD_LIMITS.address)
        && US_STATES.some(state => state.code === shipping.state)
        && ZIP_PATTERN.test(shipping.zip);

    return isComplete ? shipping : null;
}

function toItemRow(item: CartItem) {
    return {
        image: item.image,
        price_cents: item.priceCents,
        product_slug: item.productSlug,
        quantity: item.quantity,
        size: item.size ?? null,
        sku: item.sku,
        title: item.title,
        variation: item.variation,
    };
}

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request }) => {
    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const email = readText(body, 'email');
    const lines = readLines(body.items);
    const prodsApplied = readInteger(body, 'prodsApplied');
    const promoCode = readText(body, 'promoCode');
    const requestId = readText(body, 'requestId');
    const shipping = readShipping(body.shipping);
    const totalCents = readInteger(body, 'totalCents');

    if (!lines || prodsApplied === null || totalCents === null) return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    if (requestId && !UUID_PATTERN.test(requestId)) return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    if (!EMAIL_PATTERN.test(email) || email.length > FIELD_LIMITS.email) return Response.json({ error: EMAIL_MESSAGE }, { status: 400 });
    if (!shipping) return Response.json({ error: ADDRESS_MESSAGE }, { status: 400 });
    if (promoCode && !isPromoCode(promoCode)) return Response.json({ error: PROMO_CODE_MESSAGE }, { status: 400 });

    const limited = await limitRequest('orders', clientAddress);

    if (limited) return limited;

    const user = await getRequestUser(request);

    if (!user && getRequestToken(request)) return Response.json({ error: SIGN_IN_FIRST_MESSAGE }, { status: 401 });
    if (prodsApplied > 0 && !user) return Response.json({ error: SIGN_IN_MESSAGE }, { status: 401 });

    const products = await getCollection('products');

    const items = priceLines(lines, products);

    if (!items) return Response.json({ error: CART_CHANGED_MESSAGE }, { status: 409 });

    const dueCents = getTotals(items, 0, promoCode).totalCents;
    const totals = getTotals(items, prodsApplied, promoCode);

    const isChargeable = totals.totalCents === 0 || totals.totalCents >= COMMERCE.minChargeCents;
    const isRedeemable = prodsApplied >= 0 && prodsApplied <= toProds(dueCents);

    if (!isChargeable || !isRedeemable || totals.totalCents !== totalCents) return Response.json({ error: CART_CHANGED_MESSAGE }, { status: 409 });

    const admin = createAdminClient();
    const stripe = getStripe();

    if (!admin || (!stripe && totals.totalCents > 0)) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const slugs = new Set(items.map(item => item.productSlug));

    const stock = products
        .filter(entry => slugs.has(entry.id))
        .map(entry => [entry.id, entry.data.stock]);

    const { data, error } = await admin.rpc('place_order', {
        p_email: email,
        p_items: items.map(toItemRow),
        p_prods: prodsApplied,
        p_prods_cents: totals.discountCents - totals.promoCents,
        p_promo_cents: totals.promoCents,
        p_promo_code: promoCode ? COMMERCE.discountCode : '',
        p_request_id: requestId && totals.totalCents === 0 ? requestId : null,
        p_shipping: {
            city: shipping.city,
            family_name: shipping.familyName,
            given_name: shipping.givenName,
            line1: shipping.line1,
            line2: shipping.line2,
            state: shipping.state,
            zip: shipping.zip,
        },
        p_stock: Object.fromEntries(stock),
        p_subtotal_cents: totals.subtotalCents,
        p_tax_cents: totals.taxCents,
        p_total_cents: totals.totalCents,
        p_user_id: user?.id ?? null,
    });

    if (error && CONFLICT_CODES.some(code => code === error.message)) return Response.json({ error: CART_CHANGED_MESSAGE }, { status: 409 });
    if (error) return Response.json({ error: NOT_PLACED_MESSAGE }, { status: 500 });

    const placed: PlacedRow = data;

    const order: Order = {
        account: user?.email ?? '',
        email,
        id: placed.number,
        items,
        placedAt: Date.parse(placed.placed_at),
        totals,
    };

    if (stripe) await Promise.allSettled(placed.superseded.map(intentId => stripe.paymentIntents.cancel(intentId)));

    if (!stripe || totals.totalCents === 0) return Response.json({ clientSecret: null, order }, { status: 201 });

    let intent: Stripe.PaymentIntent | null;

    try {
        intent = await stripe.paymentIntents.create({
            allowed_payment_method_types: ['card'],
            amount: totals.totalCents,
            currency: 'usd',
            description: `Order ${placed.number}`,
            metadata: { order_id: placed.id },
            receipt_email: email,
            shipping: {
                address: {
                    city: shipping.city,
                    country: 'US',
                    line1: shipping.line1,
                    line2: shipping.line2 || undefined,
                    postal_code: shipping.zip,
                    state: shipping.state,
                },
                name: `${shipping.givenName} ${shipping.familyName}`,
            },
        }, { idempotencyKey: `order-${placed.id}` });
    } catch {
        intent = null;
    }

    if (!intent?.client_secret) {
        await admin.from('orders').update({ status: 'canceled' }).eq('id', placed.id).eq('status', 'pending');

        return Response.json({ error: INTENT_MESSAGE }, { status: 500 });
    }

    await admin.from('orders').update({ stripe_payment_intent_id: intent.id }).eq('id', placed.id);

    return Response.json({ clientSecret: intent.client_secret, order }, { status: 201 });
};
