import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from 'astro:env/client';
import { createClient } from '@supabase/supabase-js';

import { SIGN_IN_FIRST_MESSAGE } from '@lib/shared/constants';

import type { SupabaseClient, User } from '@supabase/supabase-js';

type AdminGuard = { ok: false; response: Response } | { ok: true; supabase: SupabaseClient };

const ADMIN_ONLY_MESSAGE = 'Only the admin can do that.';
const AUTH_OPTIONS = { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } as const;
const BEARER_PREFIX = 'Bearer ';
const STATUS_FORBIDDEN = 403;
const STATUS_UNAUTHORIZED = 401;

function buildRefusal(error: string, status: number): AdminGuard {
    return { ok: false, response: Response.json({ error }, { status }) };
}

function createAdminClient(): SupabaseClient | null {
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!secretKey) return null;

    return createClient(SUPABASE_URL, secretKey, { auth: AUTH_OPTIONS });
}

function createServerClient(accessToken = ''): SupabaseClient {
    if (!accessToken) return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: AUTH_OPTIONS });

    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: AUTH_OPTIONS,
        global: { headers: { Authorization: `${BEARER_PREFIX}${accessToken}` } },
    });
}

function getRequestToken(request: Request): string {
    const header = request.headers.get('Authorization') ?? '';

    return header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : '';
}

async function getRequestUser(request: Request): Promise<User | null> {
    const token = getRequestToken(request);

    if (!token) return null;

    const { data } = await createServerClient().auth.getUser(token);

    return data.user;
}

async function requireAdmin(request: Request): Promise<AdminGuard> {
    const token = getRequestToken(request);

    if (!token) return buildRefusal(SIGN_IN_FIRST_MESSAGE, STATUS_UNAUTHORIZED);

    const supabase = createServerClient(token);

    const { data, error } = await supabase.rpc('get_account');

    if (error) return buildRefusal(SIGN_IN_FIRST_MESSAGE, STATUS_UNAUTHORIZED);

    const account: Record<string, unknown> | null = data;

    if (account?.admin !== true) return buildRefusal(ADMIN_ONLY_MESSAGE, STATUS_FORBIDDEN);

    return { ok: true, supabase };
}

export { createAdminClient, createServerClient, getRequestToken, getRequestUser, requireAdmin };
