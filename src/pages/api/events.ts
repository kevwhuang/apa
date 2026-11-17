import { isUpcoming, toAustinIso } from '@lib/shared/utils';
import { loadEvents } from '@lib/programs/calendar';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    const events = await loadEvents();

    const records = events.map(event => ({
        ...event,
        ends_at: toAustinIso(event.ends_at),
        program: event.program.id,
        sponsors: event.program.id === 'bash' || event.sponsors.length > 0 ? event.sponsors : undefined,
        starts_at: toAustinIso(event.starts_at),
        status: isUpcoming(event.ends_at) ? 'upcoming' : 'past',
    }));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
