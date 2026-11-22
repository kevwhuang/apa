import { EMAIL_MESSAGE, EMAIL_PATTERN, NETWORK_MESSAGE, PERMISSION_DENIED } from '@lib/shared/constants';
import { getAccessToken, supabase } from '@lib/shared/supabase';
import { sendRequest } from '@lib/shared/request';

const CODE_EXPIRED_MESSAGE = 'That code has expired. Scan the code at the door again.';

const ERROR_CODES: Partial<Record<string, CheckInErrorCode>> = {
    check_in_closed: 'closed',
    check_in_full: 'full',
    door_code_expired: 'expired',
    email_invalid: 'invalid-email',
};

const MESSAGES: Record<CheckInErrorCode, string> = {
    'closed': 'Check-in is closed right now.',
    'expired': CODE_EXPIRED_MESSAGE,
    'full': 'Check-in is busy right now. Find a host at the door.',
    'invalid-email': EMAIL_MESSAGE,
    'missing': 'Scan the code at the door to check in.',
    'unavailable': NETWORK_MESSAGE,
};

async function checkIn(code: string, email: string, wantsNewsletter: boolean): Promise<CheckInResult> {
    if (!code) return reject('missing');
    if (!EMAIL_PATTERN.test(email)) return reject('invalid-email');

    const { data, error } = await supabase.rpc('check_in', { p_code: code, p_email: email, p_newsletter: wantsNewsletter });

    if (error) return reject(ERROR_CODES[error.message] ?? 'unavailable');

    const answer: Record<string, unknown> | null = data;

    if (typeof answer?.event_id !== 'string') return reject('unavailable');

    return {
        confirmed: answer.confirmed === true,
        eventId: answer.event_id,
        ok: true,
        prods: typeof answer.prods === 'number' ? answer.prods : null,
        repeated: answer.repeated === true,
    };
}

async function getDoorCode(): Promise<DoorCode | null | undefined> {
    const { data, error } = await supabase.rpc('get_door_code');

    if (error && error.code !== PERMISSION_DENIED) return undefined;

    const answer: Record<string, unknown> | null = data;

    if (typeof answer?.code !== 'string' || typeof answer.event_id !== 'string' || typeof answer.seconds_left !== 'number') return null;

    return { code: answer.code, eventId: answer.event_id, secondsLeft: answer.seconds_left };
}

async function getDoorEvent(code: string): Promise<null | string> {
    const { data } = await supabase.rpc('get_door_event', { p_code: code });

    return typeof data === 'string' ? data : null;
}

function reject(code: CheckInErrorCode): CheckInResult {
    return { code, message: MESSAGES[code], ok: false };
}

async function syncEvents(): Promise<boolean> {
    const result = await sendRequest('/api/sync', { method: 'POST', token: await getAccessToken() });

    return result.ok;
}

export { CODE_EXPIRED_MESSAGE, checkIn, getDoorCode, getDoorEvent, syncEvents };
