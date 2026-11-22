import { isUpcoming, toAustinIso } from '@lib/shared/utils';
import { limitRequest } from '@lib/server/limiter';
import { loadEvents } from '@lib/programs/calendar';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ clientAddress }) => {
    const limited = await limitRequest('content', clientAddress);

    if (limited) return limited;

    const events = await loadEvents();

    const records = events.map(event => ({
        ...event,
        ends_at: toAustinIso(event.ends_at),
        starts_at: toAustinIso(event.starts_at),
        status: isUpcoming(event.ends_at) ? 'upcoming' : 'past',
    }));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
