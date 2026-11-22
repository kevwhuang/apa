import { CHECK_VIOLATION, EMAIL_MAX_LENGTH, EMAIL_MESSAGE, EMAIL_PATTERN, INVALID_BODY_MESSAGE } from '@lib/shared/constants';
import { createAdminClient, createServerClient, getRequestToken, getRequestUser } from '@lib/server/supabase';
import { isEmailConfigured, sendEmail } from '@lib/server/email';
import { limitRequest, limitSite, toLimitResponse } from '@lib/server/limiter';

import type { APIRoute } from 'astro';

const FLOOD_RETRY_SECONDS = 3_600;
const NOT_SAVED_MESSAGE = 'The signup was not saved. Try again in a moment.';

const WELCOME = {
    footnote: 'You are getting this because this address was added to the dispatch at austinproduceralliance.com.',
    heading: 'You are on the list',
    label: 'The dispatch',
    paragraphs: [
        'This address now gets the dispatch from Austin Producer Alliance.',
        'We send one email a season with what is on the calendar, what the roster has been working on, and where to find us next.',
        'If you did not sign up, or you change your mind, the link below takes you off the list.',
    ],
    preheader: 'One email a season from Austin Producer Alliance.',
    subject: 'You are on the list',
    tag: 'newsletter_welcome',
} as const;

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request, site }) => {
    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) return Response.json({ error: EMAIL_MESSAGE }, { status: 400 });

    const limited = await limitRequest('newsletter', clientAddress);

    if (limited) return limited;

    const admin = createAdminClient();

    const user = await getRequestUser(request);

    const isOwner = user?.email === email && Boolean(user.email_confirmed_at);

    const { data, error } = admin
        ? await admin.rpc('add_subscriber', { p_email: email, p_is_owner: isOwner })
        : await createServerClient(user ? getRequestToken(request) : '').rpc('subscribe_newsletter', { p_email: email });

    if (error?.message === 'newsletter_flooded') return toLimitResponse({ isLimited: true, retryAfterSeconds: FLOOD_RETRY_SECONDS });
    if (error?.code === CHECK_VIOLATION) return Response.json({ error: EMAIL_MESSAGE }, { status: 400 });
    if (error) return Response.json({ error: NOT_SAVED_MESSAGE }, { status: 500 });

    if (typeof data === 'string' && isEmailConfigured() && !(await limitSite('welcome')).isLimited) {
        await sendEmail({ ...WELCOME, to: email, unsubscribeUrl: new URL(`/api/unsubscribe?token=${data}`, site).href });
    }

    return Response.json({ subscribed: true });
};
