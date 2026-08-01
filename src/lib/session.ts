import {
    DEMO_CREDENTIALS,
    EMAIL_PATTERN,
    MILLISECONDS_PER_DAY,
    MOCK_LATENCY_MS,
    PASSWORD_MIN_LENGTH,
    SESSION_TTL_DAYS,
    STORAGE,
    WELCOME_PRODS,
} from '@lib/constants';
import { createStore } from '@lib/state';
import { delay } from '@lib/utils';

const MESSAGES: Record<SessionErrorCode, string> = {
    'already-registered': 'That address is already registered. Sign in instead.',
    'invalid-credentials': 'That email and password do not match.',
    'invalid-email': 'Enter a valid email address.',
    'weak-password': `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
};

const store = createStore<Session | null>({
    fallback: null,
    key: STORAGE.session.key,
    normalize: normalizeSession,
    scope: STORAGE.session.scope,
    topic: STORAGE.session.topic,
});

export async function endSession(): Promise<void> {
    await delay(MOCK_LATENCY_MS);

    store.remove();
}

export function getSession(): Session | null {
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

function normalizeSession(value: Session | null): Session | null {
    if (typeof value !== 'object' || value === null) return null;
    if (typeof value.email !== 'string' || value.email.length === 0) return null;

    return {
        createdAt: Number(value.createdAt) || 0,
        displayName: String(value.displayName ?? ''),
        email: value.email,
        expiresAt: Number(value.expiresAt) || 0,
        onboarded: value.onboarded === true,
        prods: Math.max(0, Math.trunc(Number(value.prods)) || 0),
        username: String(value.username ?? ''),
    };
}

export function onSessionChange(callback: (session: Session | null) => void): () => void {
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

export async function startSession(draft: SessionDraft): Promise<SessionResult> {
    const email = draft.email.trim().toLowerCase();
    const password = draft.password ?? '';

    await delay(MOCK_LATENCY_MS);

    if (!EMAIL_PATTERN.test(email)) return reject('invalid-email');
    if (email === DEMO_CREDENTIALS.takenEmail) return reject('already-registered');
    if (password === DEMO_CREDENTIALS.wrongPassword) return reject('invalid-credentials');
    if (password.length > 0 && password.length < PASSWORD_MIN_LENGTH) return reject('weak-password');

    const existing = getSession();
    const now = Date.now();

    const session: Session = {
        createdAt: existing?.email === email ? existing.createdAt : now,
        displayName: draft.displayName ?? (existing?.email === email ? existing.displayName : ''),
        email,
        expiresAt: now + SESSION_TTL_DAYS * MILLISECONDS_PER_DAY,
        onboarded: existing?.email === email ? existing.onboarded : false,
        prods: existing?.email === email ? existing.prods : WELCOME_PRODS,
        username: draft.username ?? (existing?.email === email ? existing.username : ''),
    };

    store.set(session);

    return { ok: true, session };
}

export function syncSessionAttribute(): void {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.session = isSignedIn() ? 'in' : 'out';
}

export async function updateSession(patch: Partial<Session>): Promise<Session | null> {
    await delay(MOCK_LATENCY_MS);

    const session = getSession();

    if (!session) return null;

    return store.set({ ...session, ...patch });
}
