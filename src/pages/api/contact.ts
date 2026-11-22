import { CONTACT_LIMITS, CONTACT_MESSAGES, CONTACT_TOPICS, EMAIL_PATTERN, INVALID_BODY_MESSAGE } from '@lib/shared/constants';
import { composeContactEmail } from '@lib/shared/email';
import { isEmailConfigured, sendEmail } from '@lib/server/email';
import { limitRequest, limitSite, toLimitResponse } from '@lib/server/limiter';
import { readText } from '@lib/shared/utils';

import type { APIRoute } from 'astro';

const NOT_CONFIGURED_MESSAGE = 'Email service is not configured.';
const NOT_SENT_MESSAGE = 'The message was not sent. Try again in a moment.';

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request }) => {
    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const email = readText(body, 'email');
    const message = readText(body, 'message');
    const name = readText(body, 'name').replace(/\s+/g, ' ');
    const topic = readText(body, 'topic');

    if (!name || name.length > CONTACT_LIMITS.name) return Response.json({ error: CONTACT_MESSAGES.name }, { status: 400 });
    if (!EMAIL_PATTERN.test(email) || email.length > CONTACT_LIMITS.email) return Response.json({ error: CONTACT_MESSAGES.email }, { status: 400 });
    if (!CONTACT_TOPICS.some(entry => entry === topic)) return Response.json({ error: CONTACT_MESSAGES.topic }, { status: 400 });

    if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.message) {
        return Response.json({ error: CONTACT_MESSAGES.message }, { status: 400 });
    }

    const limited = await limitRequest('contact', clientAddress);

    if (limited) return limited;

    const contactEmail = process.env.CONTACT_EMAIL;

    if (!contactEmail || !isEmailConfigured()) return Response.json({ error: NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const quota = await limitSite('contact');

    if (quota.isLimited) return toLimitResponse(quota);

    const composed = composeContactEmail({ email, message, name, topic });

    const result = await sendEmail({
        footnote: `Reply to this email to answer ${name}.`,
        heading: topic,
        label: 'Contact form',
        paragraphs: [],
        preheader: composed.preheader,
        quote: message,
        replyTo: composed.replyTo,
        rows: [
            { label: 'From', value: composed.from },
            { label: 'Topic', value: topic },
        ],
        subject: composed.subject,
        tag: 'contact',
        to: contactEmail,
    });

    if (!result.ok) return Response.json({ error: NOT_SENT_MESSAGE }, { status: 500 });

    return Response.json({ sent: true });
};
