import { defineMiddleware } from 'astro:middleware';

import { NOT_FOUND_MESSAGE, SECURITY_HEADERS } from '@lib/shared/constants';

function applySecurityHeaders(response: Response) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        if (!response.headers.has(name)) response.headers.set(name, value);
    }

    return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
    if (context.url.pathname === '/500') return applySecurityHeaders(await next());

    const isApi = context.url.pathname.startsWith('/api/');

    try {
        const response = await next();

        if (isApi && response.body === null && response.status === 404) return Response.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });

        if (isApi) return response;

        if (response.status >= 500) return applySecurityHeaders(await context.rewrite('/500'));

        return applySecurityHeaders(response);
    } catch {
        if (isApi) return Response.json({ error: 'Internal server error.' }, { status: 500 });

        return applySecurityHeaders(await context.rewrite('/500'));
    }
});
