import { GIFT_FAILED_MESSAGE, NETWORK_MESSAGE } from '@lib/shared/constants';
import { getAccessToken } from '@lib/shared/supabase';
import { sendRequest } from '@lib/shared/request';

type GivingInput = { amountCents: number; email: string; kind: 'once'; payment: PaymentField } | { email: string; kind: 'monthly'; payment: PaymentField; tier: 'backer' | 'patron' | 'supporter' };

const GIVING_PATH = '/api/giving';
const PORTAL_PATH = '/api/portal';
const RETURN_PATH = '/partners';

async function give(input: GivingInput): Promise<ActionResult> {
    const submitted = await input.payment.submit();

    if (!submitted.ok) return submitted;

    const token = await getAccessToken();

    const result = await sendRequest(GIVING_PATH, {
        body: input.kind === 'once'
            ? { amountCents: input.amountCents, email: input.email, kind: input.kind }
            : { email: input.email, kind: input.kind, tier: input.tier },
        method: 'POST',
        token,
    });

    if (!result.ok) return { message: result.code === 'network' ? GIFT_FAILED_MESSAGE : result.message, ok: false };

    const { clientSecret } = result.data;

    if (typeof clientSecret !== 'string') return { message: GIFT_FAILED_MESSAGE, ok: false };

    return input.payment.confirm(clientSecret, RETURN_PATH);
}

async function openBillingPortal(): Promise<ActionResult> {
    const token = await getAccessToken();

    const result = await sendRequest(PORTAL_PATH, { method: 'POST', token });

    if (!result.ok) return { message: result.message, ok: false };

    const { url } = result.data;

    if (typeof url !== 'string') return { message: NETWORK_MESSAGE, ok: false };

    window.location.assign(url);

    return { ok: true };
}

export { give, openBillingPortal };
