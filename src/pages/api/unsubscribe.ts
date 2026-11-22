import { UNSUBSCRIBE_PARAMETER } from '@lib/shared/constants';
import { createServerClient } from '@lib/server/supabase';

import type { APIRoute } from 'astro';

const LINK_MESSAGE = 'That unsubscribe link is not valid.';
const NOT_SAVED_MESSAGE = 'The change was not saved. Try again in a moment.';
const TOKEN_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function parseToken(url: URL) {
    const token = url.searchParams.get('token') ?? '';

    return TOKEN_PATTERN.test(token) ? token : null;
}

export const prerender = false;

export const GET: APIRoute = ({ redirect, url }) => {
    const token = parseToken(url);

    if (!token) return Response.json({ error: LINK_MESSAGE }, { status: 400 });

    return redirect(`/?${UNSUBSCRIBE_PARAMETER}=${token}`, 303);
};

export const POST: APIRoute = async ({ url }) => {
    const token = parseToken(url);

    if (!token) return Response.json({ error: LINK_MESSAGE }, { status: 400 });

    const { data, error } = await createServerClient().rpc('unsubscribe_newsletter', { p_token: token });

    if (error) return Response.json({ error: NOT_SAVED_MESSAGE }, { status: 500 });
    if (data !== true) return Response.json({ error: LINK_MESSAGE }, { status: 404 });

    return Response.json({ unsubscribed: true });
};
