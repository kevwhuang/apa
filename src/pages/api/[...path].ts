import { NOT_FOUND_MESSAGE } from '@lib/shared/constants';

import type { APIRoute } from 'astro';

export const prerender = false;

export const ALL: APIRoute = () => Response.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
