import { BRAND } from '@lib/shared/brand';
import { LINKS, ONBOARDING_ROUTE } from '@lib/shared/constants';

function composeContactEmail(input: ContactEmailInput): ComposedEmail {
    const { email, message, name, topic } = input;

    const subject = `${topic} \u00b7 ${name}`;

    return {
        actionHref: `mailto:${LINKS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
        actionLabel: 'Send it yourself',
        body: [message],
        from: `${name} <${email}>`,
        preheader: `${topic} from ${name}`,
        replyTo: email,
        subject,
        to: LINKS.email,
    };
}

function composeOnboardingEmail(input: OnboardingEmailInput): ComposedEmail {
    return {
        actionHref: ONBOARDING_ROUTE,
        actionLabel: 'Finish profile',
        body: [
            'Thanks for checking in. You\'re part of the Alliance now.',
            'Your account is open with your first Prods on it. Prods are our credit for taking part. They add up as you show up, and each one takes $1.00 off in the store.',
            'The link below signs you in and drops you into the last few basics, so the rest of the roster knows who you are and what you make.',
            'The link works for the next hour.',
        ],
        from: `${BRAND.name} <${LINKS.email}>`,
        preheader: 'Finish your profile and claim your first Prods.',
        replyTo: LINKS.email,
        subject: `Welcome to ${BRAND.name}`,
        to: input.email,
    };
}

export { composeContactEmail, composeOnboardingEmail };
