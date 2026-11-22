import { PAYMENTS_NOT_CONFIGURED_MESSAGE, SETTINGS_ROUTE, SIGN_IN_FIRST_MESSAGE } from '@lib/shared/constants';
import { findCustomer, getStripe } from '@lib/server/stripe';
import { getRequestUser } from '@lib/server/supabase';
import { limitRequest } from '@lib/server/limiter';

import type { APIRoute } from 'astro';

const MISSING_MESSAGE = 'No billing profile on file.';

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request, url }) => {
    const limited = await limitRequest('portal', clientAddress);

    if (limited) return limited;

    const user = await getRequestUser(request);

    if (!user?.email) return Response.json({ error: SIGN_IN_FIRST_MESSAGE }, { status: 401 });

    const stripe = getStripe();

    if (!stripe) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const customer = await findCustomer(user.email, user.id, stripe);

    if (!customer) return Response.json({ error: MISSING_MESSAGE }, { status: 404 });

    const session = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: new URL(SETTINGS_ROUTE, url).href });

    return Response.json({ url: session.url });
};
