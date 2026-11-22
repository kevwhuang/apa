import { getStore } from '@netlify/blobs';

import type { GetWithMetadataResult } from '@netlify/blobs';

type RateRoute = keyof typeof RATE_BUDGETS;
type SiteQuota = keyof typeof SITE_QUOTAS;

interface RateBudget {
    limit: number;
    windowSeconds: number;
}

interface RateRecord {
    count: number;
    windowStart: number;
}

interface RateVerdict {
    isLimited: boolean;
    retryAfterSeconds: number;
}

const CONFLICT_RETRY_SECONDS = 1;
const CONTENT_WINDOW_MINUTES = 10;
const MEMORY_LIMIT = 5_000;
const MILLISECONDS_PER_SECOND = 1_000;
const RATE_LIMIT_MESSAGE = 'Too many requests. Try again later.';
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const STORE_NAME = 'rate-limits';
const TURN_TIMEOUT_SECONDS = 2;
const WRITE_ATTEMPTS = 3;

const RATE_BUDGETS = {
    ask: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
    contact: { limit: 5, windowSeconds: SECONDS_PER_HOUR },
    content: { limit: 120, windowSeconds: CONTENT_WINDOW_MINUTES * SECONDS_PER_MINUTE },
    giving: { limit: 10, windowSeconds: SECONDS_PER_HOUR },
    newsletter: { limit: 30, windowSeconds: SECONDS_PER_HOUR },
    orders: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
    portal: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
    welcome: { limit: 10, windowSeconds: SECONDS_PER_HOUR },
} as const;

const SITE_QUOTAS = {
    accountWelcome: { limit: 80, windowSeconds: SECONDS_PER_DAY },
    ask: { limit: 200, windowSeconds: SECONDS_PER_DAY },
    contact: { limit: 40, windowSeconds: SECONDS_PER_DAY },
    welcome: { limit: 40, windowSeconds: SECONDS_PER_DAY },
} as const;

const memory = new Map<string, RateRecord>();
const queues = new Map<string, Promise<void>>();

function checkMemory(key: string, budget: RateBudget, now: number, isCounted: boolean) {
    const tally = tallyRate(memory.get(key) ?? null, budget, now, isCounted);

    if (!tally.isChanged) return tally.verdict;

    if (memory.size >= MEMORY_LIMIT) memory.clear();

    memory.set(key, tally.record);

    return tally.verdict;
}

async function checkRate(key: string, budget: RateBudget, isCounted = true): Promise<RateVerdict> {
    const previous = queues.get(key);
    const turn = Promise.withResolvers<void>();

    queues.set(key, turn.promise);

    await previous;

    const timer = setTimeout(turn.resolve, TURN_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND);

    try {
        return await checkStore(key, budget, Date.now(), isCounted);
    } finally {
        clearTimeout(timer);
        turn.resolve();

        if (queues.get(key) === turn.promise) queues.delete(key);
    }
}

async function checkStore(key: string, budget: RateBudget, now: number, isCounted: boolean) {
    try {
        const store = getStore({ consistency: 'strong', name: STORE_NAME });

        for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
            const entry = await store.getWithMetadata(key, { type: 'json' });

            const tally = tallyRate(toRecord(entry?.data), budget, now, isCounted);

            if (!tally.isChanged) return tally.verdict;

            const write = await store.setJSON(key, tally.record, toCondition(entry));

            if (write.modified) return tally.verdict;
        }

        return { isLimited: true, retryAfterSeconds: CONFLICT_RETRY_SECONDS };
    } catch {
        return checkMemory(key, budget, now, isCounted);
    }
}

async function limitRequest(route: RateRoute, clientAddress: string): Promise<Response | null> {
    if (import.meta.env.DEV) return null;

    const verdict = await checkRate(`${route}/${clientAddress}`, RATE_BUDGETS[route]);

    return verdict.isLimited ? toLimitResponse(verdict) : null;
}

function limitSite(quota: SiteQuota): Promise<RateVerdict> {
    return checkRate(`site/${quota}`, SITE_QUOTAS[quota]);
}

function tallyRate(record: RateRecord | null, budget: RateBudget, now: number, isCounted: boolean) {
    const windowMilliseconds = budget.windowSeconds * MILLISECONDS_PER_SECOND;

    const current = record && now - record.windowStart < windowMilliseconds ? record : { count: 0, windowStart: now };

    const isLimited = current.count >= budget.limit;

    const isChanged = isCounted && !isLimited;

    return {
        isChanged,
        record: isChanged ? { count: current.count + 1, windowStart: current.windowStart } : current,
        verdict: {
            isLimited,
            retryAfterSeconds: isLimited ? Math.ceil((current.windowStart + windowMilliseconds - now) / MILLISECONDS_PER_SECOND) : 0,
        },
    };
}

function toCondition(entry: GetWithMetadataResult | null) {
    if (!entry) return { onlyIfNew: true };

    return entry.etag ? { onlyIfMatch: entry.etag } : {};
}

function toLimitResponse(verdict: RateVerdict): Response {
    return Response.json({ error: RATE_LIMIT_MESSAGE }, {
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(verdict.retryAfterSeconds) },
        status: 429,
    });
}

function toRecord(value: unknown) {
    if (typeof value !== 'object' || value === null || !('count' in value) || !('windowStart' in value)) return null;

    const { count, windowStart } = value;

    return typeof count === 'number' && typeof windowStart === 'number' ? { count, windowStart } : null;
}

export { checkRate, limitRequest, limitSite, toLimitResponse };
