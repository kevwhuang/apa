import { navigate } from 'astro:transitions/client';

import { SETTINGS_ROUTE } from '@lib/shared/constants';
import { getSession, isSessionEnding, onSessionChange, whenSessionReady } from '@lib/account/session';

type RouteAccess = 'admin' | 'member';

const NEXT_PARAMETER = 'next';

function enforce(access: RouteAccess) {
    const session = getSession();

    if (!session) {
        if (!isSessionEnding()) void navigate(`/signin?${NEXT_PARAMETER}=${encodeURIComponent(window.location.pathname)}`, { history: 'replace' });

        return true;
    }

    if (access === 'admin' && !session.admin) {
        void navigate(SETTINGS_ROUTE, { history: 'replace' });

        return true;
    }

    return false;
}

function getNextPath(): string {
    const next = new URLSearchParams(window.location.search).get(NEXT_PARAMETER) ?? '';

    try {
        const target = new URL(next, window.location.origin);

        const path = `${target.pathname}${target.search}${target.hash}`;

        const isLocal = next.startsWith('/') && target.origin === window.location.origin && !path.startsWith('//');

        return isLocal ? path : SETTINGS_ROUTE;
    } catch {
        return SETTINGS_ROUTE;
    }
}

async function guardRoute(access: RouteAccess, signal: AbortSignal): Promise<void> {
    await whenSessionReady();

    if (signal.aborted) return;
    if (enforce(access)) return;

    const unsubscribe = onSessionChange(() => {
        if (enforce(access)) unsubscribe();
    });

    signal.addEventListener('abort', unsubscribe, { once: true });
}

export { getNextPath, guardRoute };
