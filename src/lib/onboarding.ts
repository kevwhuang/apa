import {
    MILLISECONDS_PER_HOUR,
    ONBOARDING_ROUTE,
    ONBOARDING_TOKEN_PARAM,
    ONBOARDING_TOKEN_TTL_HOURS,
    PASSWORD_MIN_LENGTH,
    RESERVED_USERNAMES,
    STORAGE,
} from '@lib/constants';
import { createStore } from '@lib/state';
import { getSession } from '@lib/session';

const BASE64_GROUP = 4;

const DEFAULT_DRAFT: OnboardingDraft = {
    answers: {},
    displayName: '',
    email: '',
    genres: [],
    location: 'Austin, TX',
    passwordSet: false,
    step: 1,
    username: '',
};

const MAX_PASSWORD_SCORE = 4;

const STRONG_PASSWORD_LENGTH = 16;

const draft = createStore<OnboardingDraft>({
    fallback: DEFAULT_DRAFT,
    key: STORAGE.onboardingDraft.key,
    normalize: normalizeDraft,
    scope: STORAGE.onboardingDraft.scope,
    topic: STORAGE.onboardingDraft.topic,
});

export function clearOnboardingDraft(): void {
    draft.remove();
}

export function createOnboardingToken(email: string): string {
    return encodeToken({ email: email.trim().toLowerCase(), issuedAt: Date.now(), nonce: crypto.randomUUID() });
}

function decodeToken(value: string): OnboardingToken | null {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / BASE64_GROUP) * BASE64_GROUP, '=');
        const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

        if (typeof parsed !== 'object' || parsed === null) return null;
        if (!('email' in parsed) || typeof parsed.email !== 'string' || parsed.email.length === 0) return null;
        if (!('issuedAt' in parsed) || typeof parsed.issuedAt !== 'number') return null;
        if (!('nonce' in parsed) || typeof parsed.nonce !== 'string') return null;

        return { email: parsed.email, issuedAt: parsed.issuedAt, nonce: parsed.nonce };
    } catch {
        return null;
    }
}

function encodeToken(token: OnboardingToken): string {
    const bytes = new TextEncoder().encode(JSON.stringify(token));
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getOnboardingDraft(): OnboardingDraft {
    return draft.get();
}

export function getOnboardingHref(email: string): string {
    return `${ONBOARDING_ROUTE}?${ONBOARDING_TOKEN_PARAM}=${createOnboardingToken(email)}`;
}

export function isReservedUsername(username: string): boolean {
    const candidate = username.trim().toLowerCase();

    return RESERVED_USERNAMES.some(reserved => reserved === candidate);
}

function normalizeAnswers(answers: Record<string, string[]>): Record<string, string[]> {
    if (typeof answers !== 'object' || answers === null) return {};

    return Object.fromEntries(Object.entries(answers)
        .filter(([, values]) => Array.isArray(values))
        .map(([question, values]) => [question, values.map(String)]));
}

function normalizeDraft(value: OnboardingDraft): OnboardingDraft {
    if (typeof value !== 'object' || value === null) return DEFAULT_DRAFT;

    return {
        answers: normalizeAnswers(value.answers),
        displayName: String(value.displayName ?? ''),
        email: String(value.email ?? ''),
        genres: Array.isArray(value.genres) ? value.genres.map(String) : [],
        location: String(value.location ?? DEFAULT_DRAFT.location),
        passwordSet: value.passwordSet === true,
        step: Math.max(1, Math.trunc(Number(value.step)) || 1),
        username: String(value.username ?? ''),
    };
}

export function saveOnboardingDraft(patch: Partial<OnboardingDraft>): OnboardingDraft {
    return draft.update(current => ({ ...current, ...patch }));
}

export function scorePassword(password: string): number {
    if (password.length === 0) return 0;

    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter(pattern => pattern.test(password)).length;
    const lengthPoints = Number(password.length >= PASSWORD_MIN_LENGTH) + Number(password.length >= STRONG_PASSWORD_LENGTH);

    return Math.min(MAX_PASSWORD_SCORE, classes + lengthPoints - 1);
}

export function verifyOnboardingToken(token: string | null): OnboardingGate {
    if (!token) return { reason: 'missing', state: 'rejected' };

    const decoded = decodeToken(token);

    if (!decoded) return { reason: 'malformed', state: 'rejected' };
    if (Date.now() - decoded.issuedAt > ONBOARDING_TOKEN_TTL_HOURS * MILLISECONDS_PER_HOUR) return { reason: 'expired', state: 'rejected' };
    if (getSession()?.onboarded === true) return { reason: 'completed', state: 'rejected' };

    return { email: decoded.email, state: 'granted', token: decoded };
}
