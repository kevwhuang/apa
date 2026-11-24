import { INVALID_BODY_MESSAGE, PAYMENTS_NOT_CONFIGURED_MESSAGE, SERVER_ERROR_MESSAGE } from '@lib/shared/constants';
import { createAdminClient } from '@lib/server/supabase';
import { limitRequest } from '@lib/server/limiter';
import { loadPromo } from '@lib/server/promo';
import { readText } from '@lib/shared/utils';

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request }) => {
    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const code = readText(body, 'code');

    if (!code) return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const limited = await limitRequest('promo', clientAddress);

    if (limited) return limited;

    const admin = createAdminClient();

    if (!admin) return Response.json({ error: PAYMENTS_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const lookup = await loadPromo(admin, code);

    if (!lookup.ok) return Response.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });

    return Response.json({ promo: lookup.promo });
};
