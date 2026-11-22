import { ingestSite } from '@lib/server/ingest';
import { requireAdmin } from '@lib/server/supabase';

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
    const guard = await requireAdmin(request);

    if (!guard.ok) return guard.response;

    const result = await ingestSite(url.origin, guard.supabase);

    if (!result.ok) return Response.json({ error: result.message }, { status: 500 });

    return Response.json({ complete: result.complete, embedded: result.embedded, removed: result.removed, total: result.total });
};
