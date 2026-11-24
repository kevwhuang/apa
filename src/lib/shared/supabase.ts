import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from 'astro:env/client';
import { createClient } from '@supabase/supabase-js';

import { ONBOARDING_ROUTE, SETTINGS_ROUTE } from '@lib/shared/constants';
import { isRecord } from '@lib/shared/utils';

const LINK_ROUTES: string[] = [ONBOARDING_ROUTE, SETTINGS_ROUTE];

const authStorageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: isAuthCallback, storageKey: authStorageKey } });

async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? '';
}

function isAuthCallback(url: URL, parameters: Record<string, string>) {
    if (!LINK_ROUTES.includes(url.pathname)) return false;
    if (parameters.error || parameters.error_code || parameters.error_description) return true;
    if (!parameters.access_token) return false;

    const stored = readStoredToken();
    const subject = readSubject(parameters.access_token);

    if (!stored || (subject && subject === readSubject(stored))) return true;

    window.history.replaceState(window.history.state, '', url.pathname);

    return false;
}

function readStoredToken() {
    try {
        const stored: unknown = JSON.parse(window.localStorage.getItem(authStorageKey) ?? 'null');

        return isRecord(stored) && typeof stored.access_token === 'string' ? stored.access_token : '';
    } catch {
        return '';
    }
}

function readSubject(token: string) {
    try {
        const claims: unknown = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));

        return isRecord(claims) && typeof claims.sub === 'string' ? claims.sub : '';
    } catch {
        return '';
    }
}

export { getAccessToken, supabase };
