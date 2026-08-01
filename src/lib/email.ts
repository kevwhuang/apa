import { LINKS, ONBOARDING_ROUTE, ONBOARDING_TOKEN_PARAM } from '@lib/constants';

const SENDER_NAME = 'Austin Producer Alliance';

export function composeContactEmail(input: ContactEmailInput): MockEmail {
    const { email, message, name, topic } = input;

    const subject = `${topic} \u2014 ${name}`;

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

export function composeOnboardingEmail(input: OnboardingEmailInput): MockEmail {
    const { email, eventName, prods, token } = input;

    const greeting = eventName
        ? `Thanks for checking in at ${eventName}. You're part of the Alliance now.`
        : 'Thanks for checking in. You\'re part of the Alliance now.';

    return {
        actionHref: `${ONBOARDING_ROUTE}?${ONBOARDING_TOKEN_PARAM}=${token}`,
        actionLabel: 'Finish your profile',
        body: [
            greeting,
            `Your account is open with ${formatProds(prods)} on it. Prods are our credit for taking part \u2014 they add up as you show up, and they spend like cash in the store.`,
            'Take a minute to finish your profile so the rest of the roster knows who you are and what you make. It is three short steps and the link below picks up where you left off.',
            'The link works for the next 24 hours. If it expires, check in again and we will send a fresh one.',
        ],
        from: `${SENDER_NAME} <${LINKS.email}>`,
        preheader: `Finish your profile and claim ${formatProds(prods)}.`,
        replyTo: LINKS.email,
        subject: `Welcome to ${SENDER_NAME}`,
        to: email,
    };
}

function formatProds(prods: number): string {
    const count = Math.max(0, Math.trunc(prods) || 0);

    return count === 1 ? '1 Prod' : `${count} Prods`;
}
