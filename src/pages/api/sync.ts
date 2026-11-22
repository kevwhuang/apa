import { MILLISECONDS_PER_HOUR } from '@lib/shared/constants';
import { formatLongMonth, toAustinIso } from '@lib/shared/utils';
import { loadEvents } from '@lib/programs/calendar';
import { requireAdmin } from '@lib/server/supabase';

import type { APIRoute } from 'astro';

const RETIRE_LEAD_HOURS = 1;
const SYNC_FAILED_MESSAGE = 'The events could not be synced.';

function getEventLabel(event: EventRecord) {
    if (event.program !== 'Assembly') return `${event.title} ${event.program}`;

    const month = formatLongMonth(event.starts_at);

    return event.speaker ? `${month} ${event.program} \u00b7 ${event.speaker.name}` : `${month} ${event.program}`;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const guard = await requireAdmin(request);

    if (!guard.ok) return guard.response;

    const events = await loadEvents();

    const rows = events.map(event => ({
        ends_at: toAustinIso(event.ends_at),
        id: event.id,
        label: getEventLabel(event),
        program: event.program.toLowerCase(),
        starts_at: toAustinIso(event.starts_at),
    }));

    const { error } = await guard.supabase.from('events').upsert(rows, { onConflict: 'id' });

    if (error) return Response.json({ error: SYNC_FAILED_MESSAGE }, { status: 500 });

    const now = Date.now();

    const cutoff = toAustinIso(new Date(now + RETIRE_LEAD_HOURS * MILLISECONDS_PER_HOUR));

    const futureIds = events
        .filter(event => event.starts_at.getTime() > now)
        .map(event => event.id);

    let candidates = guard.supabase.from('events').select('id').gt('starts_at', cutoff);

    if (futureIds.length > 0) candidates = candidates.not('id', 'in', `(${futureIds.join(',')})`);

    const { data: stale } = await candidates;

    await Promise.all((stale ?? []).map(row => guard.supabase.from('events').delete().eq('id', row.id)));

    return Response.json({ synced: rows.length });
};
