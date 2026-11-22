import { EMAIL_MAX_LENGTH, EMAIL_MESSAGE, EMAIL_PATTERN, GIFT_FAILED_MESSAGE, INVALID_BODY_MESSAGE, PAYMENTS_NOT_CONFIGURED_MESSAGE } from '@lib/shared/constants';
import { findCustomer, getStripe } from '@lib/server/stripe';
import { getRequestUser } from '@lib/server/supabase';
import { limitRequest } from '@lib/server/limiter';

import type Stripe from 'stripe';
import type { APIRoute } from 'astro';

interface Support {
    account: string;
    amountCents: number;
    email: string;
    product: string;
    tier: string;
    userId: string;
}

const ACTIVE_STATUSES = ['active', 'past_due', 'trialing'] as const;
const AMOUNT_MESSAGE = 'Enter an amount between $1 and $5,000.';
const DUPLICATE_MESSAGE = 'You already support monthly.';
const GIVING_MAX_CENTS = 500_000;
const GIVING_MIN_CENTS = 100;
const SIGN_IN_MESSAGE = 'Sign in to support monthly.';
const SUBSCRIPTION_LIMIT = 10;

const SUPPORT_TIERS = [
    { cents: 2_500, id: 'backer' },
    { cents: 25_000, id: 'patron' },
    { cents: 500, id: 'supporter' },
] as const;

async function createGift(amountCents: number, email: string, userId: string, stripe: Stripe) {
    try {
        const intent = await stripe.paymentIntents.create({
            allowed_payment_method_types: ['card'],
            amount: amountCents,
            currency: 'usd',
            description: 'Donation',
            metadata: userId ? { email, kind: 'donation', user_id: userId } : { email, kind: 'donation' },
            receipt_email: email,
        });

        if (!intent.client_secret) return Response.json({ error: GIFT_FAILED_MESSAGE }, { status: 500 });

        return Response.json({ clientSecret: intent.client_secret }, { status: 201 });
    } catch {
        return Response.json({ error: GIFT_FAILED_MESSAGE }, { status: 500 });
    }
}

async function createSupport(support: Support, stripe: Stripe) {
    const { account, amountCents, email, product, tier, userId } = support;

    try {
        const customer = await findCustomer(account, userId, stripe)
            ?? await stripe.customers.create({ email: account, metadata: { user_id: userId } }, { idempotencyKey: `customer-${userId}` });

        const subscriptions = await stripe.subscriptions.list({ customer: customer.id, limit: SUBSCRIPTION_LIMIT, status: 'all' });

        const isSupporting = subscriptions.data.some(subscription => ACTIVE_STATUSES.some(status => status === subscription.status));

        if (isSupporting) return Response.json({ error: DUPLICATE_MESSAGE }, { status: 409 });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            expand: ['latest_invoice.confirmation_secret'],
            items: [{ price_data: { currency: 'usd', product, recurring: { interval: 'month' }, unit_amount: amountCents } }],
            metadata: { email, tier, user_id: userId },
            payment_behavior: 'default_incomplete',
            payment_settings: { payment_method_types: ['card'], save_default_payment_method: 'on_subscription' },
        });

        const invoice = subscription.latest_invoice;

        const clientSecret = invoice && typeof invoice === 'object' ? invoice.confirmation_secret?.client_secret : null;

        if (!clientSecret) return Response.json({ error: GIFT_FAILED_MESSAGE }, { status: 500 });

        return Response.json({ clientSecret }, { status: 201 });
    } catch {
        return Response.json({ error: GIFT_FAILED_MESSAGE }, { status: 500 });
    }
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

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const isMonthly = body.kind === 'monthly';

    const tier = isMonthly ? SUPPORT_TIERS.find(candidate => candidate.id === body.tier) : undefined;

    const amountCents = tier ? tier.cents : body.amountCents;

    if (isMonthly && !tier) return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    if (!isMonthly && body.kind !== 'once') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) return Response.json({ error: EMAIL_MESSAGE }, { status: 400 });

    if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < GIVING_MIN_CENTS || amountCents > GIVING_MAX_CENTS) {
        return Response.json({ error: AMOUNT_MESSAGE }, { status: 400 });
    }

    const limited = await limitRequest('giving', clientAddress);

    if (limited) return limited;

    const product = process.env.STRIPE_SUPPORT_PRODUCT_ID;
    const stripe = getStripe();

    const user = await getRequestUser(request);

    if (tier) {
        if (!user?.email) return Response.json({ error: SIGN_IN_MESSAGE }, { status: 401 });
        if (!product || !stripe) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

        return createSupport({ account: user.email, amountCents, email, product, tier: tier.id, userId: user.id }, stripe);
    }

    if (!stripe) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    return createGift(amountCents, email, user?.id ?? '', stripe);
};
