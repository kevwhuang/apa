import { STRIPE_PUBLISHABLE_KEY } from 'astro:env/client';
import { loadStripe } from '@stripe/stripe-js/pure';

import { PAYMENT_FAILED_MESSAGE, STORAGE } from '@lib/shared/constants';
import { PAYMENT_UNAVAILABLE_MESSAGE } from '@lib/commerce/checkout';

import type { Appearance, Stripe, StripeElements } from '@stripe/stripe-js';

interface LiveField {
    elements: StripeElements;
    readOnly: boolean;
}

const CURRENCY = 'usd';
const FONT_FAMILY = 'ui-monospace, monospace';

let liveField: LiveField | null = null;
let stripeLoad: Promise<Stripe | null> | null = null;

function buildAppearance(isReadOnly: boolean): Appearance {
    const styles = getComputedStyle(document.documentElement);

    const background = readToken(styles, isReadOnly ? '--color-input-bg-disabled' : '--color-input-bg');
    const border = readToken(styles, isReadOnly ? '--color-input-border-disabled' : '--color-input-border');
    const text = readToken(styles, isReadOnly ? '--color-input-text-disabled' : '--color-input-text');

    return {
        rules: {
            '.Input': { border: `2px solid ${border}`, boxShadow: 'none', padding: '8px 16px' },
            '.Input--invalid': { borderColor: readToken(styles, '--color-input-border-invalid') },
            '.Label': { letterSpacing: '0.06em', textTransform: 'uppercase' },
        },
        theme: 'flat',
        variables: {
            borderRadius: '0px',
            colorBackground: background,
            colorDanger: readToken(styles, '--color-error-text'),
            colorPrimary: readToken(styles, '--color-input-border-focus'),
            colorText: text,
            colorTextPlaceholder: readToken(styles, '--color-input-placeholder'),
            colorTextSecondary: readToken(styles, '--color-text-secondary'),
            fontFamily: FONT_FAMILY,
        },
    };
}

function buildField(stripe: Stripe, amountCents: number, mode: 'payment' | 'subscription'): PaymentField {
    const elements = stripe.elements({
        allowedPaymentMethodTypes: ['card'],
        amount: amountCents,
        appearance: buildAppearance(false),
        currency: CURRENCY,
        mode,
    });

    const element = elements.create('payment', { layout: 'tabs' });
    const field: LiveField = { elements, readOnly: false };

    let amount = amountCents;
    let hasLoadFailed = false;
    let isMounted = false;

    async function confirm(clientSecret: string, returnPath: string): Promise<ActionResult> {
        try {
            const { error } = await stripe.confirmPayment({
                clientSecret,
                confirmParams: { return_url: `${window.location.origin}${returnPath}` },
                elements,
                redirect: 'if_required',
            });

            return error ? { message: error.message ?? PAYMENT_FAILED_MESSAGE, ok: false } : { ok: true };
        } catch {
            return { message: PAYMENT_FAILED_MESSAGE, ok: false };
        }
    }

    function destroy(): void {
        if (!hasLoadFailed) element.destroy();

        if (liveField === field) liveField = null;
    }

    function mount(container: HTMLElement): void {
        if (isMounted) return;

        element.mount(container);
        isMounted = true;
    }

    function setAmount(cents: number): void {
        if (cents <= 0 || cents === amount) return;

        amount = cents;
        void elements.update({ amount });
    }

    function setReadOnly(isReadOnly: boolean): void {
        if (hasLoadFailed || isReadOnly === field.readOnly) return;

        field.readOnly = isReadOnly;
        element.update({ readOnly: isReadOnly });
        void elements.update({ appearance: buildAppearance(isReadOnly) });
    }

    async function submit(): Promise<ActionResult> {
        if (hasLoadFailed) return { message: PAYMENT_UNAVAILABLE_MESSAGE, ok: false };

        try {
            const { error } = await elements.submit();

            return error ? { message: error.message ?? PAYMENT_FAILED_MESSAGE, ok: false } : { ok: true };
        } catch {
            return { message: PAYMENT_FAILED_MESSAGE, ok: false };
        }
    }

    element.on('loaderror', () => {
        hasLoadFailed = true;
    });

    liveField = field;

    return { confirm, destroy, mount, setAmount, setReadOnly, submit };
}

async function createPaymentField(amountCents: number, mode: 'payment' | 'subscription' = 'payment'): Promise<PaymentField | null> {
    if (!STRIPE_PUBLISHABLE_KEY) return null;

    stripeLoad ??= loadStripe(STRIPE_PUBLISHABLE_KEY);

    try {
        const stripe = await stripeLoad;

        return stripe ? buildField(stripe, amountCents, mode) : null;
    } catch {
        stripeLoad = null;

        return null;
    }
}

function handleThemeChange() {
    if (liveField) void liveField.elements.update({ appearance: buildAppearance(liveField.readOnly) });
}

function readToken(styles: CSSStyleDeclaration, name: string) {
    return styles.getPropertyValue(name).trim();
}

if (typeof window !== 'undefined') window.addEventListener(STORAGE.theme.topic, handleThemeChange);

export { createPaymentField };
