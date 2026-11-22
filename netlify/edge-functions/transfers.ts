import { checkRate, toLimitResponse } from '../../src/lib/server/limiter.ts';

import type { Config, Context } from '@netlify/edge-functions';

const AUDIO_PREFIX = '/audio/';
const PROBE_RANGE = 'bytes=0-1';
const RANGE_START = 'bytes=0-';
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

const BUDGETS = {
    assets: { limit: 200, windowSeconds: SECONDS_PER_HOUR },
    audio: { limit: 60, windowSeconds: SECONDS_PER_HOUR },
} as const;

async function limitTransfers(request: Request, context: Context) {
    const range = request.headers.get('range');

    if (range !== null && !range.startsWith(RANGE_START)) return undefined;

    const group = new URL(request.url).pathname.startsWith(AUDIO_PREFIX) ? 'audio' : 'assets';
    const isCounted = range !== PROBE_RANGE && request.method === 'GET';

    const verdict = await checkRate(`${group}/${context.ip}`, BUDGETS[group], isCounted);

    return verdict.isLimited ? toLimitResponse(verdict) : undefined;
}

export const config: Config = {
    onError: 'bypass',
    path: ['/assets/*', '/audio/*'],
    rateLimit: { aggregateBy: ['ip', 'domain'], windowLimit: 240, windowSize: SECONDS_PER_MINUTE },
};

export default limitTransfers;
