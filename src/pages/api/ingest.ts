import { createAdminClient, getRequestToken, requireAdmin } from '@lib/server/supabase';
import { ingestSite } from '@lib/server/ingest';
import { isDeployToken } from '@lib/server/deploy';

import type { APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';

async function runIngest(origin: string, supabase: SupabaseClient) {
    const result = await ingestSite(origin, supabase);

    if (!result.ok) return Response.json({ error: result.message }, { status: 500 });

    return Response.json({ complete: result.complete, embedded: result.embedded, removed: result.removed, total: result.total });
}

export const prerender = false;

export const POST: APIRoute = async ({ request, site, url }) => {
    const isDeploy = isDeployToken(getRequestToken(request), request.headers.get('x-nf-deploy-id') ?? '') && url.origin === site?.origin;

    const admin = isDeploy ? createAdminClient() : null;

    if (admin) return runIngest(url.origin, admin);

    const guard = await requireAdmin(request);

    if (!guard.ok) return guard.response;

    return runIngest(url.origin, guard.supabase);
};
