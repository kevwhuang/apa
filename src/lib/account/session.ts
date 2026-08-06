import {
    DEMO_CREDENTIALS,
    EMAIL_PATTERN,
    MILLISECONDS_PER_DAY,
    MOCK_LATENCY_MS,
    PASSWORD_MIN_LENGTH,
    SESSION_TTL_DAYS,
    STORAGE,
    WELCOME_PRODS,
} from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';
import { delay } from '@lib/shared/utils';
import { normalizeAvatar } from '@lib/account/images';

const DEFAULT_ROLE = 'fan';

const MESSAGES: Record<SessionErrorCode, string> = {
    'already-registered': 'That address is already registered. Sign in instead.',
    'invalid-credentials': 'That email and password do not match.',
    'invalid-email': 'Enter a valid email address.',
    'weak-password': `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
};

const profiles = createStore<Record<string, Profile>>({
    fallback: {},
    key: STORAGE.profiles.key,
    normalize: normalizeProfiles,
    scope: STORAGE.profiles.scope,
    topic: STORAGE.profiles.topic,
});

const store = createStore<Session | null>({
    fallback: null,
    key: STORAGE.session.key,
    normalize: normalizeSession,
    scope: STORAGE.session.scope,
    topic: STORAGE.session.topic,
});

async function endSession(): Promise<void> {
    await delay(MOCK_LATENCY_MS);

    store.remove();
}

function getProfile(email: string): Profile | null {
    return profiles.get()[email] ?? null;
}

function getSession(): Session | null {
    const session = store.get();

    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        store.remove();

        return null;
    }

    return session;
}

function handleStorageEvent(event: StorageEvent, callback: (session: Session | null) => void): void {
    if (event.key !== null && event.key !== STORAGE.session.key) return;

    callback(getSession());
}

function isSignedIn(): boolean {
    return getSession() !== null;
}

function normalizeProfile(value: Profile): Profile {
    return {
        artistName: String(value.artistName ?? ''),
        avatar: normalizeAvatar(String(value.avatar ?? '')),
        createdAt: Number(value.createdAt) || 0,
        onboarded: value.onboarded === true,
        prods: Math.max(0, Math.trunc(Number(value.prods)) || 0),
        role: String(value.role ?? '') || DEFAULT_ROLE,
    };
}

function normalizeProfiles(value: Record<string, Profile>): Record<string, Profile> {
    if (typeof value !== 'object' || value === null) return {};

    const entries = Object.entries(value).filter(([email, profile]) => email.length > 0 && typeof profile === 'object' && profile !== null);

    return Object.fromEntries(entries.map(([email, profile]) => [email, normalizeProfile(profile)]));
}

function normalizeSession(value: Session | null): Session | null {
    if (typeof value !== 'object' || value === null) return null;
    if (typeof value.email !== 'string' || value.email.length === 0) return null;

    return {
        artistName: String(value.artistName ?? '') || toDisplayName(value.email),
        avatar: normalizeAvatar(String(value.avatar ?? '')),
        createdAt: Number(value.createdAt) || 0,
        email: value.email,
        expiresAt: Number(value.expiresAt) || 0,
        onboarded: value.onboarded === true,
        prods: Math.max(0, Math.trunc(Number(value.prods)) || 0),
        role: String(value.role ?? '') || DEFAULT_ROLE,
    };
}

function onSessionChange(callback: (session: Session | null) => void): () => void {
    const unsubscribe = store.onChange(() => callback(getSession()));

    if (typeof window === 'undefined') return unsubscribe;

    const controller = new AbortController();

    window.addEventListener('storage', event => handleStorageEvent(event, callback), { signal: controller.signal });

    return () => {
        controller.abort();
        unsubscribe();
    };
}

function reject(code: SessionErrorCode): SessionResult {
    return { code, message: MESSAGES[code], ok: false };
}

function saveProfile(session: Session): void {
    const profile: Profile = {
        artistName: session.artistName,
        avatar: session.avatar,
        createdAt: session.createdAt,
        onboarded: session.onboarded,
        prods: session.prods,
        role: session.role || DEFAULT_ROLE,
    };

    profiles.update(current => ({ ...current, [session.email.toLowerCase()]: profile }));
}

async function startSession(draft: SessionDraft): Promise<SessionResult> {
    const email = draft.email.trim().toLowerCase();
    const password = draft.password ?? '';

    await delay(MOCK_LATENCY_MS);

    if (!EMAIL_PATTERN.test(email)) return reject('invalid-email');
    if (email === DEMO_CREDENTIALS.takenEmail) return reject('already-registered');
    if (password === DEMO_CREDENTIALS.wrongPassword) return reject('invalid-credentials');
    if (password.length > 0 && password.length < PASSWORD_MIN_LENGTH) return reject('weak-password');

    const existing = getSession();
    const now = Date.now();

    const profile: Profile | null = existing?.email === email ? existing : getProfile(email);

    const session: Session = {
        artistName: draft.artistName || profile?.artistName || toDisplayName(email),
        avatar: profile?.avatar ?? '',
        createdAt: profile?.createdAt || now,
        email,
        expiresAt: now + SESSION_TTL_DAYS * MILLISECONDS_PER_DAY,
        onboarded: profile?.onboarded ?? false,
        prods: profile?.prods ?? WELCOME_PRODS,
        role: profile?.role || DEFAULT_ROLE,
    };

    saveProfile(session);
    store.set(session);

    return { ok: true, session };
}

function syncSessionAttribute(): void {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.session = isSignedIn() ? 'in' : 'out';
}

function toDisplayName(email: string): string {
    const words = email.split('@')[0].split(/[+._-]+/).filter(Boolean);

    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function updateSession(patch: Partial<Session>): Promise<Session | null> {
    await delay(MOCK_LATENCY_MS);

    const session = getSession();

    if (!session) return null;

    const next = store.set({ ...session, ...patch });

    if (next) saveProfile(next);

    return next;
}

export { endSession, getSession, onSessionChange, startSession, syncSessionAttribute, updateSession };
