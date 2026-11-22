import { Resend } from 'resend';

import template from '@lib/server/email.html?raw';
import { BRAND } from '@lib/shared/brand';
import { LINKS, PARAGRAPH_SEPARATOR } from '@lib/shared/constants';
import { escapeHtml } from '@lib/shared/utils';

type EmailResult = { code: 'not-configured' | 'rejected'; ok: false } | { id: string; ok: true };

interface EmailAction {
    href: string;
    label: string;
}

interface EmailMessage {
    action?: EmailAction;
    footnote: string;
    heading: string;
    label: string;
    paragraphs: readonly string[];
    preheader: string;
    quote?: string;
    replyTo?: string;
    rows?: EmailRow[];
    subject: string;
    tag: string;
    to: string;
    unsubscribeUrl?: string;
}

interface EmailRow {
    label: string;
    value: string;
}

const COLOR_BG_SUNKEN = '#f0ebde';
const COLOR_BORDER_SUBTLE = '#d7d2c6';
const COLOR_LINK = '#bb4202';
const COLOR_TEXT = '#171310';
const COLOR_TEXT_SECONDARY = '#6f6a63';
const FONT_MONO = '\'Space Mono\', \'Courier New\', monospace';
const FONT_SANS = '\'Bricolage Grotesque\', Arial, sans-serif';
const ORGANIZATION_PLACE = 'Austin, Texas';

function isEmailConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
}

function renderBody(message: EmailMessage) {
    const { action, paragraphs, quote, rows = [] } = message;

    const blocks = paragraphs.map(text => renderParagraph(escapeHtml(text)));

    if (rows.length > 0) blocks.push(renderRows(rows));

    if (quote) {
        blocks.push(`<p style="background-color: ${COLOR_BG_SUNKEN}; color: ${COLOR_TEXT}; font-family: ${FONT_SANS}; font-size: 16px; line-height: 1.6; margin: 0 0 4px; padding: 16px; white-space: pre-wrap; word-break: break-word">${escapeHtml(quote)}</p>`);
    }

    if (action) blocks.push(renderParagraph(renderLink(action.href, action.label)));

    return blocks.join('');
}

function renderFooter(message: EmailMessage) {
    const { footnote, unsubscribeUrl } = message;

    const lines = [escapeHtml(footnote)];

    if (unsubscribeUrl) lines.push(renderLink(unsubscribeUrl, 'Unsubscribe'));

    lines.push(`${escapeHtml(BRAND.name)} &middot; ${escapeHtml(ORGANIZATION_PLACE)} &middot; ${renderLink(LINKS.hub, new URL(LINKS.hub).host)}`);

    return lines.map(line => `<p style="color: ${COLOR_TEXT_SECONDARY}; font-family: ${FONT_SANS}; font-size: 14px; line-height: 1.5; margin: 0 0 8px">${line}</p>`).join('');
}

function renderHtml(message: EmailMessage) {
    const replacements: Record<string, string> = {
        body: renderBody(message),
        footer: renderFooter(message),
        heading: escapeHtml(message.heading),
        label: escapeHtml(message.label),
        preheader: escapeHtml(message.preheader),
        subject: escapeHtml(message.subject),
    };

    return template.replace(/\{\{(body|footer|heading|label|preheader|subject)\}\}/g, (_match, token: string) => replacements[token]);
}

function renderLink(href: string, label: string) {
    return `<a href="${escapeHtml(href)}" style="color: ${COLOR_LINK}; text-decoration: underline">${escapeHtml(label)}</a>`;
}

function renderParagraph(html: string) {
    return `<p style="color: ${COLOR_TEXT}; font-family: ${FONT_SANS}; font-size: 16px; line-height: 1.6; margin: 0 0 16px">${html}</p>`;
}

function renderRows(rows: EmailRow[]) {
    const tableRows = rows.map(row => `<tr><td style="border-bottom: 1px solid ${COLOR_BORDER_SUBTLE}; color: ${COLOR_TEXT_SECONDARY}; font-family: ${FONT_MONO}; font-size: 12px; letter-spacing: 0.06em; padding: 8px 12px 8px 0; text-transform: uppercase; vertical-align: top; white-space: nowrap; width: 72px">${escapeHtml(row.label)}</td><td style="border-bottom: 1px solid ${COLOR_BORDER_SUBTLE}; color: ${COLOR_TEXT}; font-family: ${FONT_MONO}; font-size: 14px; padding: 8px 0; word-break: break-word">${escapeHtml(row.value)}</td></tr>`);

    return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 20px" width="100%">${tableRows.join('')}</table>`;
}

function renderText(message: EmailMessage) {
    const { action, footnote, heading, paragraphs, quote, rows = [], unsubscribeUrl } = message;

    const blocks = [heading, ...paragraphs];

    if (rows.length > 0) blocks.push(rows.map(row => `${row.label}: ${row.value}`).join('\n'));
    if (quote) blocks.push(quote);
    if (action) blocks.push(`${action.label}: ${action.href}`);

    blocks.push(footnote);

    if (unsubscribeUrl) blocks.push(`Unsubscribe: ${unsubscribeUrl}`);

    blocks.push(`${BRAND.name} \u00b7 ${ORGANIZATION_PLACE}`, LINKS.hub);

    return blocks.join(PARAGRAPH_SEPARATOR);
}

async function sendEmail(message: EmailMessage): Promise<EmailResult> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) return { code: 'not-configured', ok: false };

    const { replyTo, subject, tag, to, unsubscribeUrl } = message;

    const headers = unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;

    const { data, error } = await new Resend(apiKey).emails.send({
        from: `${BRAND.name} <${LINKS.email}>`,
        headers,
        html: renderHtml(message),
        replyTo,
        subject,
        tags: [{ name: 'category', value: tag }],
        text: renderText(message),
        to,
    });

    if (!data || error) return { code: 'rejected', ok: false };

    return { id: data.id, ok: true };
}

export { isEmailConfigured, sendEmail };
