import { NETWORK_MESSAGE, SECONDS_PER_MINUTE, SERVER_ERROR_MESSAGE, STATUS_SERVER_ERROR } from '@lib/shared/constants';
import { isRecord } from '@lib/shared/utils';

interface RequestOptions {
    body?: Record<string, unknown>;
    method?: 'GET' | 'HEAD' | 'POST';
    signal?: AbortSignal;
    token?: string;
}

const HOURS_THRESHOLD_SECONDS = 7_200;
const SECONDS_PER_HOUR = 3_600;

const STATUS_CODES: Record<number, RequestErrorCode> = {
    401: 'unauthorized',
    403: 'unauthorized',
    409: 'conflict',
    503: 'not-configured',
};

const STATUS_TOO_MANY = 429;

function describeWait(retryAfter: null | string) {
    const seconds = Number(retryAfter);

    if (retryAfter === null || !Number.isFinite(seconds) || seconds <= 0) return 'a few minutes';
    if (seconds <= SECONDS_PER_MINUTE) return 'a minute';
    if (seconds < HOURS_THRESHOLD_SECONDS) return `${Math.ceil(seconds / SECONDS_PER_MINUTE)} minutes`;

    return `${Math.ceil(seconds / SECONDS_PER_HOUR)} hours`;
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
    try {
        const body: unknown = await response.json();

        return isRecord(body) ? body : {};
    } catch {
        return {};
    }
}

async function sendRequest(path: string, options: RequestOptions = {}): Promise<RequestResult> {
    const { body, method, signal, token } = options;
    const headers = new Headers();

    if (body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;

    try {
        response = await fetch(path, { body: body ? JSON.stringify(body) : undefined, headers, method, signal });
    } catch {
        return { code: 'network', message: NETWORK_MESSAGE, ok: false };
    }

    if (response.status === STATUS_TOO_MANY) {
        return { code: 'rate-limited', message: `Too many requests. Try again in ${describeWait(response.headers.get('Retry-After'))}.`, ok: false };
    }

    if (!response.ok) {
        const { error } = await readBody(response);

        const message = typeof error === 'string' ? error : SERVER_ERROR_MESSAGE;

        return { code: STATUS_CODES[response.status] ?? (response.status >= STATUS_SERVER_ERROR ? 'unavailable' : 'rejected'), message, ok: false };
    }

    return { data: await readBody(response), ok: true };
}

export { sendRequest };
