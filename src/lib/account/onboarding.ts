import {
    MILLISECONDS_PER_HOUR,
    ONBOARDING_ROUTE,
    ONBOARDING_TOKEN_PARAM,
    ONBOARDING_TOKEN_TTL_HOURS,
    STORAGE,
} from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';
import { normalizeAvatar } from '@lib/account/images';

interface OnboardingSave {
    draft: OnboardingDraft;
    persisted: boolean;
}

const BASE64_GROUP = 4;

const DEFAULT_DRAFT: OnboardingDraft = {
    artistName: '',
    avatar: '',
    email: '',
    genres: [],
    location: '',
    roles: [],
    step: 1,
};

const store = createStore<OnboardingDraft>({
    fallback: DEFAULT_DRAFT,
    key: STORAGE.onboardingDraft.key,
    normalize: normalizeDraft,
    scope: STORAGE.onboardingDraft.scope,
    topic: STORAGE.onboardingDraft.topic,
});

function clearOnboardingDraft(): void {
    store.remove();
}

function createOnboardingToken(email: string): string {
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

function getOnboardingDraft(): OnboardingDraft {
    return store.get();
}

function getOnboardingHref(email: string): string {
    return `${ONBOARDING_ROUTE}?${ONBOARDING_TOKEN_PARAM}=${createOnboardingToken(email)}`;
}

function normalizeDraft(value: OnboardingDraft): OnboardingDraft {
    if (typeof value !== 'object' || value === null) return DEFAULT_DRAFT;

    return {
        artistName: String(value.artistName ?? ''),
        avatar: normalizeAvatar(String(value.avatar ?? '')),
        email: String(value.email ?? ''),
        genres: Array.isArray(value.genres) ? value.genres.map(String) : [],
        location: String(value.location ?? ''),
        roles: Array.isArray(value.roles) ? value.roles.map(String) : [],
        step: Math.max(1, Math.trunc(Number(value.step)) || 1),
    };
}

function saveOnboardingDraft(patch: Partial<OnboardingDraft>): OnboardingSave {
    const next = store.update(current => ({ ...current, ...patch }));

    return { draft: next, persisted: store.persisted() };
}

function verifyOnboardingToken(token: string | null): OnboardingGate {
    if (!token) return { reason: 'missing', state: 'rejected' };

    const decoded = decodeToken(token);

    if (!decoded) return { reason: 'malformed', state: 'rejected' };
    if (Date.now() - decoded.issuedAt > ONBOARDING_TOKEN_TTL_HOURS * MILLISECONDS_PER_HOUR) return { reason: 'expired', state: 'rejected' };

    return { email: decoded.email, state: 'granted', token: decoded };
}

export {
    clearOnboardingDraft,
    createOnboardingToken,
    getOnboardingDraft,
    getOnboardingHref,
    saveOnboardingDraft,
    verifyOnboardingToken,
};
