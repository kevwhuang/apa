import { ONBOARDING_ROUTE, SETTINGS_ROUTE, SIGN_IN_FIRST_MESSAGE } from '@lib/shared/constants';
import { createServerClient, getRequestToken, getRequestUser } from '@lib/server/supabase';
import { isEmailConfigured, sendEmail } from '@lib/server/email';
import { limitRequest, limitSite } from '@lib/server/limiter';

import type { APIRoute } from 'astro';

const NEXT_STEPS = {
    onboarding: {
        label: 'Finish profile',
        paragraph: 'The link below takes you through three short steps: the basics, what the account is for, and a look around.',
        path: ONBOARDING_ROUTE,
    },
    settings: {
        label: 'Settings',
        paragraph: 'Settings lists every event you have attended and every Prod you have earned or spent, with a running balance beside each one.',
        path: SETTINGS_ROUTE,
    },
} as const;

const NOT_SENT_MESSAGE = 'The welcome email was not sent.';

const WELCOME = {
    footnote: 'You are getting this because an account at austinproduceralliance.com was confirmed with this address.',
    heading: 'Welcome in',
    label: 'Your account',
    paragraphs: [
        'Your address is confirmed, and your account opened with a Welcome Prod on it.',
        'Prods are the Alliance\'s participation currency. You earn them by showing up and taking part, and each one takes $1 off at checkout.',
    ],
    preheader: 'Your address is confirmed and your account is open.',
    subject: 'Welcome to Austin Producer Alliance',
    tag: 'account_welcome',
} as const;

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request, site }) => {
    const user = await getRequestUser(request);

    if (!user?.email) return Response.json({ error: SIGN_IN_FIRST_MESSAGE }, { status: 401 });
    if (!isEmailConfigured() || !user.email_confirmed_at) return Response.json({ sent: false });

    const limited = await limitRequest('welcome', clientAddress);

    if (limited) return limited;

    const supabase = createServerClient(getRequestToken(request));

    const { data, error } = await supabase.from('profiles').select('artist_name, onboarded, welcomed_at').eq('id', user.id).maybeSingle();

    if (error) return Response.json({ error: NOT_SENT_MESSAGE }, { status: 500 });

    const profile: Record<string, unknown> | null = data;

    if (!profile || profile.welcomed_at !== null) return Response.json({ sent: false });

    const quota = await limitSite('accountWelcome');

    if (quota.isLimited) return Response.json({ sent: false });

    const claim = await supabase.rpc('claim_welcome');

    if (claim.error) return Response.json({ error: NOT_SENT_MESSAGE }, { status: 500 });
    if (claim.data !== true) return Response.json({ sent: false });

    const name = typeof profile.artist_name === 'string' ? profile.artist_name.trim() : '';
    const next = profile.onboarded === true ? NEXT_STEPS.settings : NEXT_STEPS.onboarding;

    const result = await sendEmail({
        ...WELCOME,
        action: { href: new URL(next.path, site).href, label: next.label },
        heading: name ? `${WELCOME.heading}, ${name}` : WELCOME.heading,
        paragraphs: [...WELCOME.paragraphs, next.paragraph],
        to: user.email,
    });

    if (!result.ok) return Response.json({ error: NOT_SENT_MESSAGE }, { status: 500 });

    return Response.json({ sent: true });
};
