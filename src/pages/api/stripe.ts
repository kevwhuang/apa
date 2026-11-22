import { PAYMENTS_NOT_CONFIGURED_MESSAGE } from '@lib/shared/constants';
import { createAdminClient } from '@lib/server/supabase';
import { getStripe } from '@lib/server/stripe';

import type Stripe from 'stripe';
import type { APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';

const PROCESSING_MESSAGE = 'Event could not be processed.';
const SIGNATURE_HEADER = 'stripe-signature';
const SIGNATURE_MESSAGE = 'Invalid signature.';

async function processEvent(event: Stripe.Event, admin: SupabaseClient, stripe: Stripe) {
    try {
        if (event.type === 'charge.refunded') return await refundOrder(event.data.object, admin);
        if (event.type === 'payment_intent.succeeded') return await settleOrder(event.data.object, admin, stripe);

        return true;
    } catch {
        return false;
    }
}

async function refundOrder(charge: Stripe.Charge, admin: SupabaseClient) {
    if (!charge.refunded || typeof charge.payment_intent !== 'string') return true;

    const { data, error } = await admin.rpc('refund_order', { p_payment_intent: charge.payment_intent });

    return !error && data !== 'pending';
}

async function settleOrder(intent: Stripe.PaymentIntent, admin: SupabaseClient, stripe: Stripe) {
    const orderId = Number(intent.metadata.order_id);

    if (!Number.isInteger(orderId) || orderId < 1) return true;

    const { data, error } = await admin.rpc('settle_order', { p_order_id: orderId, p_payment_intent: intent.id });

    if (error) return false;

    if (data === 'canceled') await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${intent.id}` });

    return true;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    if (!secret || !stripe) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const payload = await request.text();

    let event: Stripe.Event;

    try {
        event = await stripe.webhooks.constructEventAsync(payload, request.headers.get(SIGNATURE_HEADER) ?? '', secret);
    } catch {
        return Response.json({ error: SIGNATURE_MESSAGE }, { status: 400 });
    }

    const admin = createAdminClient();

    if (!admin) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const isProcessed = await processEvent(event, admin, stripe);

    if (!isProcessed) return Response.json({ error: PROCESSING_MESSAGE }, { status: 500 });

    return Response.json({ received: true });
};
