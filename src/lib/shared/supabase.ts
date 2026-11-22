import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from 'astro:env/client';
import { createClient } from '@supabase/supabase-js';

import { ONBOARDING_ROUTE, SETTINGS_ROUTE } from '@lib/shared/constants';

const LINK_ROUTES: string[] = [ONBOARDING_ROUTE, SETTINGS_ROUTE];

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: isAuthCallback } });

async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? '';
}

function isAuthCallback(url: URL, parameters: Record<string, string>) {
    return LINK_ROUTES.includes(url.pathname)
        && Boolean(parameters.access_token || parameters.error || parameters.error_code || parameters.error_description);
}

export { getAccessToken, supabase };
