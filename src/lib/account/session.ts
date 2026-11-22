import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import {
    CHECK_VIOLATION,
    DEFAULT_ROLE,
    EMAIL_MESSAGE,
    EMAIL_PATTERN,
    MEMBER_ROLES,
    NETWORK_MESSAGE,
    ONBOARDING_ROUTE,
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    SETTINGS_ROUTE,
    STATUS_SERVER_ERROR,
    STORAGE,
    STORAGE_BUCKETS,
    TRACK_CONTENT_TYPES,
} from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';
import { getAvatarUrl, normalizeAvatar, removeAvatar, toAvatarPath, uploadAvatar } from '@lib/account/images';
import { getExtension } from '@lib/audio/uploads';
import { isRecord, isTrackExtension } from '@lib/shared/utils';
import { isSwitchOpen, loadSwitches } from '@lib/programs/switches';
import { sendRequest } from '@lib/shared/request';
import { supabase } from '@lib/shared/supabase';

import type { AuthChangeEvent, AuthError, RealtimeChannel, Session as AuthSession, User } from '@supabase/supabase-js';

type SessionAccess = Pick<Session, 'admin' | 'email' | 'passwordless'>;

const ACCESS_TOKEN_PARAMETER = 'access_token';
const AUTH_ERROR_PARAMETERS = ['error', 'error_code', 'error_description'] as const;
const DATA_URL_PREFIX = 'data:';

const ERROR_CODES: Partial<Record<string, SessionErrorCode>> = {
    email_address_invalid: 'invalid-email',
    email_address_not_authorized: 'email-unavailable',
    email_exists: 'already-registered',
    email_not_confirmed: 'unconfirmed',
    invalid_credentials: 'invalid-credentials',
    otp_disabled: 'signups-closed',
    over_email_send_rate_limit: 'rate-limited',
    over_request_rate_limit: 'rate-limited',
    same_password: 'same-password',
    signup_disabled: 'signups-closed',
    user_already_exists: 'already-registered',
    validation_failed: 'invalid-email',
    weak_password: 'weak-password',
};

const MESSAGES: Record<SessionErrorCode, string> = {
    'already-registered': 'That address is already registered. Sign in instead.',
    'email-unavailable': 'Account email is not being sent right now. Try again later.',
    'invalid-credentials': 'That email and password do not match.',
    'invalid-email': EMAIL_MESSAGE,
    'rate-limited': 'Too many attempts just now. Wait a minute and try again.',
    'rejected': 'Those changes were not accepted. Check each field and try again.',
    'same-password': 'Choose a password you are not already using.',
    'signed-out': 'Sign in to save changes.',
    'signups-closed': 'New accounts are closed right now.',
    'unavailable': NETWORK_MESSAGE,
    'unconfirmed': 'Confirm your email address before you sign in. Check your inbox for the link.',
    'upload-failed': 'That portrait could not be stored. Try a smaller image.',
    'weak-password': `Use ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_BYTES} characters.`,
};

const PASSWORD_METHOD = 'password';
const PROFILE_COLUMNS = 'artist_name, avatar_path, bio, city, created_at, genres, id, instagram_url, onboarded, prods, role, soundcloud_url, spotify_url, state, track_name, youtube_url';
const PROFILE_EVENT = 'profile';
const WELCOME_PATH = '/api/welcome';

const readyResolvers: ((session: Session | null) => void)[] = [];

const store = createStore<Session | null>({
    fallback: null,
    key: STORAGE.session.key,
    normalize: normalizeSession,
    scope: STORAGE.session.scope,
    topic: STORAGE.session.topic,
});

const welcomeUserIds = new Set<string>();

let authLink: AuthLink | null = null;
let channel: RealtimeChannel | null = null;
let channelUserId = '';
let isReady = false;
let isRecovering = false;
let loadedUserId = '';
let loadingUserId = '';
let snapshot: Session | null = null;

function applySession(next: Session | null) {
    const session = normalizeSession(next);

    if (JSON.stringify(session) === JSON.stringify(getSession())) return;

    snapshot = session;

    if (session) store.set(session);
    else store.remove();

    syncSessionAttribute();
}

function clearAccount() {
    isRecovering = false;
    loadedUserId = '';
    loadingUserId = '';
    applySession(null);
    closeAccountChannel();
    markReady();
}

function clearAuthLink(): void {
    authLink = null;
}

function closeAccountChannel() {
    if (channel) void supabase.removeChannel(channel);

    channel = null;
    channelUserId = '';
}

async function confirmSignedOut() {
    const { data, error } = await supabase.auth.getSession();

    if (data.session) return;

    if (isAuthRetryableFetchError(error)) markReady();
    else clearAccount();
}

async function createAccount(draft: SessionDraft): Promise<SessionResult> {
    const email = parseEmail(draft.email);

    if (!email) return reject('invalid-email');
    if (new TextEncoder().encode(draft.password).length > PASSWORD_MAX_BYTES) return reject('weak-password');

    const { data, error } = await supabase.auth.signUp({
        email,
        options: { emailRedirectTo: toAbsoluteUrl(ONBOARDING_ROUTE) },
        password: draft.password,
    });

    if (error) return reject(await toSignupErrorCode(error));

    if (data.user?.identities?.length === 0) return reject('already-registered');
    if (!data.session) return { ok: true, session: null };

    return resolveSession();
}

async function endSession(): Promise<void> {
    isReady = false;

    await Promise.race([supabase.auth.signOut({ scope: 'local' }), whenSessionReady()]);

    clearAccount();
}

async function fetchAccount() {
    const first = await supabase.rpc('get_account');

    if (first.error || !isRecord(first.data)) return null;
    if (first.data.pending !== true) return first.data;

    const claim = await supabase.rpc('claim_checkins');

    if (claim.error) return first.data;

    const second = await supabase.rpc('get_account');

    return second.error || !isRecord(second.data) ? first.data : second.data;
}

function getAuthLink(): AuthLink | null {
    return authLink;
}

function getSession(): Session | null {
    return store.get() ?? snapshot;
}

function handleAuthChange(event: AuthChangeEvent, authSession: AuthSession | null) {
    if (!authSession) {
        if (event === 'INITIAL_SESSION' && getSession()) void confirmSignedOut();
        else clearAccount();

        return;
    }

    if (event === 'PASSWORD_RECOVERY') isRecovering = true;

    const isForced = event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY';
    const { user } = authSession;

    if (user.id === loadingUserId) return;
    if (user.id === loadedUserId && getSession()?.id === user.id && !isForced) return;

    void loadAccount(user, authSession.access_token);
}

function handleHashChange(state: unknown) {
    if (window.history.state !== null) return;

    const { hash, pathname, search } = window.location;

    window.history.replaceState(state ?? { index: 0, scrollX: window.scrollX, scrollY: window.scrollY }, '', `${pathname}${search}${hash}`);
}

function handleProfileBroadcast(payload: unknown) {
    const session = getSession();

    if (!isRecord(payload) || !session || payload.id !== session.id) return;

    applySession(toSession(payload, session));
}

function handleStorageEvent(event: StorageEvent, callback: (session: Session | null) => void) {
    if (event.key !== STORAGE.session.key && event.key !== null) return;

    snapshot = store.get();
    callback(snapshot);
}

async function loadAccount(user: User, token: string) {
    isReady = false;
    loadingUserId = user.id;

    const account = await fetchAccount();

    if (loadingUserId !== user.id) return;

    loadingUserId = '';

    if (!account && getSession()?.id === user.id) {
        markReady();

        return;
    }

    if (!account || !isRecord(account.profile)) {
        void supabase.auth.signOut({ scope: 'local' });
        clearAccount();

        return;
    }

    applySession(toSession(account.profile, {
        admin: account.admin === true,
        email: user.email ?? '',
        passwordless: isRecovering || (typeof account.method === 'string' && account.method !== PASSWORD_METHOD),
    }));

    loadedUserId = user.id;
    void subscribeAccount(user.id);
    markReady();

    if (account.profile.welcomed_at !== null || welcomeUserIds.has(user.id)) return;

    welcomeUserIds.add(user.id);
    void sendRequest(WELCOME_PATH, { method: 'POST', token });
}

function markReady() {
    isReady = true;

    for (const resolve of readyResolvers.splice(0)) {
        resolve(getSession());
    }
}

function normalizeSession(value: Session | null): Session | null {
    if (typeof value !== 'object' || value === null) return null;
    if (typeof value.email !== 'string' || value.email.length === 0) return null;
    if (typeof value.id !== 'string' || value.id.length === 0) return null;

    return {
        admin: value.admin === true,
        artistName: String(value.artistName ?? '') || toDisplayName(value.email),
        avatar: normalizeAvatar(String(value.avatar ?? '')),
        bio: String(value.bio ?? ''),
        city: String(value.city ?? ''),
        createdAt: Number(value.createdAt) || 0,
        email: value.email,
        genres: Array.isArray(value.genres) ? value.genres.map(String) : [],
        id: value.id,
        links: {
            instagram: String(value.links?.instagram ?? ''),
            soundcloud: String(value.links?.soundcloud ?? ''),
            spotify: String(value.links?.spotify ?? ''),
            youtube: String(value.links?.youtube ?? ''),
        },
        onboarded: value.onboarded === true,
        passwordless: value.passwordless === true,
        prods: Math.max(0, Math.trunc(Number(value.prods)) || 0),
        role: String(value.role ?? '') || DEFAULT_ROLE,
        state: String(value.state ?? ''),
        track: String(value.track ?? ''),
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

function parseEmail(value: string) {
    const email = value.trim().toLowerCase();

    return EMAIL_PATTERN.test(email) ? email : '';
}

function readAuthLink() {
    const parameters = new URLSearchParams(window.location.hash.slice(1));

    if (AUTH_ERROR_PARAMETERS.some(name => parameters.has(name))) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);

        return 'expired';
    }

    return parameters.get('type') === 'recovery' ? 'recovery' : null;
}

function reject(code: SessionErrorCode): SessionResult {
    return { code, message: MESSAGES[code], ok: false };
}

async function requestPasswordReset(email: string): Promise<SessionResult> {
    const address = parseEmail(email);

    if (!address) return reject('invalid-email');

    const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: toAbsoluteUrl(SETTINGS_ROUTE) });

    return error ? reject(toErrorCode(error)) : { ok: true, session: null };
}

async function resolveSession(): Promise<SessionResult> {
    const session = await whenSessionReady();

    return session ? { ok: true, session } : reject('unavailable');
}

async function saveSession(patch: ProfilePatch): Promise<SessionResult> {
    const session = getSession();

    if (!session) return reject('signed-out');

    const previousPath = toAvatarPath(session.avatar);
    const row = toProfileRow(patch);

    let uploadedPath = '';

    if (patch.avatar?.startsWith(DATA_URL_PREFIX)) {
        const upload = await uploadAvatar(session.id, patch.avatar, previousPath);

        if (!upload.ok) return reject(upload.isRefused ? 'upload-failed' : 'unavailable');

        uploadedPath = upload.path;
        row.avatar_path = upload.path;
    }

    if (Object.keys(row).length === 0) return { ok: true, session };

    const failure = await updateProfile(session, row);

    if (failure) {
        if (failure.isRefused) await removeAvatar(uploadedPath);

        return reject(failure.code);
    }

    if (typeof row.avatar_path === 'string' && row.avatar_path !== previousPath) void removeAvatar(previousPath);

    return { ok: true, session: getSession() };
}

async function saveTrack(file: File | null): Promise<SessionResult> {
    const session = getSession();

    if (!session) return reject('signed-out');

    const extension = getExtension(file?.name ?? '');
    const tracks = supabase.storage.from(STORAGE_BUCKETS.tracks);

    const contentType = isTrackExtension(extension) ? TRACK_CONTENT_TYPES[extension] : '';

    if (file && !contentType) return reject('rejected');

    const { data, error } = await supabase.from('profiles').select('track_path').eq('id', session.id).single();

    if (error) return reject('unavailable');

    const path = file ? `${session.id}/spotlight/${crypto.randomUUID()}.${extension}` : '';
    const stored: Record<string, unknown> = data;

    const previousPath = String(stored.track_path ?? '');

    if (file) {
        const upload = await tracks.upload(path, file.slice(0, file.size, contentType), { contentType });

        if (upload.error) return reject('unavailable');
    }

    const failure = await updateProfile(session, { track_name: file?.name ?? '', track_path: path, track_seconds: 0 });

    if (failure) {
        if (path && failure.isRefused) await tracks.remove([path]);

        return reject(failure.code);
    }

    if (previousPath && previousPath !== path) await tracks.remove([previousPath]);

    return { ok: true, session: getSession() };
}

async function sendSignInLink(email: string): Promise<SessionResult> {
    const address = parseEmail(email);

    if (!address) return reject('invalid-email');

    const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { data: { door: true }, emailRedirectTo: toAbsoluteUrl(ONBOARDING_ROUTE) },
    });

    return error ? reject(await toSignupErrorCode(error)) : { ok: true, session: null };
}

async function startSession(draft: SessionDraft): Promise<SessionResult> {
    const email = parseEmail(draft.email);

    if (!email) return reject('invalid-email');

    const { error } = await supabase.auth.signInWithPassword({ email, password: draft.password });

    if (!error) return resolveSession();

    const code = toErrorCode(error);

    if (code === 'unconfirmed') void supabase.auth.resend({ email, options: { emailRedirectTo: toAbsoluteUrl(ONBOARDING_ROUTE) }, type: 'signup' });

    return reject(code);
}

async function subscribeAccount(userId: string) {
    if (channelUserId === userId) return;

    closeAccountChannel();
    channelUserId = userId;

    await supabase.realtime.setAuth();

    if (channelUserId !== userId) return;

    channel = supabase
        .channel(`account:${userId}`, { config: { private: true } })
        .on('broadcast', { event: PROFILE_EVENT }, message => handleProfileBroadcast(message.payload))
        .subscribe();
}

function syncSessionAttribute(): void {
    if (typeof document === 'undefined') return;

    const session = getSession();

    document.documentElement.dataset.admin = String(session?.admin === true);
    document.documentElement.dataset.session = session ? 'in' : 'out';
}

function toAbsoluteUrl(path: string) {
    return `${window.location.origin}${path}`;
}

function toDisplayName(email: string) {
    const words = email.split('@')[0].split(/[+._-]+/).filter(Boolean);

    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function toErrorCode(error: AuthError) {
    return ERROR_CODES[error.code ?? ''] ?? 'unavailable';
}

function toProfileRow(patch: ProfilePatch) {
    const row: Record<string, unknown> = {};

    if (patch.artistName !== undefined) row.artist_name = patch.artistName;
    if (patch.avatar !== undefined) row.avatar_path = toAvatarPath(patch.avatar);
    if (patch.bio !== undefined) row.bio = patch.bio;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.genres !== undefined) row.genres = patch.genres;
    if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
    if (MEMBER_ROLES.some(role => role === patch.role)) row.role = patch.role;
    if (patch.state !== undefined) row.state = patch.state;

    if (patch.links) {
        row.instagram_url = patch.links.instagram;
        row.soundcloud_url = patch.links.soundcloud;
        row.spotify_url = patch.links.spotify;
        row.youtube_url = patch.links.youtube;
    }

    return row;
}

function toSession(row: Record<string, unknown>, access: SessionAccess) {
    return {
        admin: access.admin,
        artistName: String(row.artist_name ?? '') || toDisplayName(access.email),
        avatar: getAvatarUrl(String(row.avatar_path ?? '')),
        bio: String(row.bio ?? ''),
        city: String(row.city ?? ''),
        createdAt: Date.parse(String(row.created_at ?? '')) || 0,
        email: access.email,
        genres: Array.isArray(row.genres) ? row.genres.map(String) : [],
        id: String(row.id ?? ''),
        links: {
            instagram: String(row.instagram_url ?? ''),
            soundcloud: String(row.soundcloud_url ?? ''),
            spotify: String(row.spotify_url ?? ''),
            youtube: String(row.youtube_url ?? ''),
        },
        onboarded: row.onboarded === true,
        passwordless: access.passwordless,
        prods: Math.max(0, Math.trunc(Number(row.prods)) || 0),
        role: String(row.role ?? '') || DEFAULT_ROLE,
        state: String(row.state ?? ''),
        track: String(row.track_name ?? ''),
    };
}

async function toSignupErrorCode(error: AuthError) {
    if (error.status !== STATUS_SERVER_ERROR) return toErrorCode(error);

    await loadSwitches();

    return isSwitchOpen('signups') ? 'unavailable' : 'signups-closed';
}

async function updatePassword(password: string, current: string): Promise<SessionResult> {
    const session = getSession();

    if (!session) return reject('signed-out');
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return reject('weak-password');

    if (!session.passwordless) {
        const check = await supabase.auth.signInWithPassword({ email: session.email, password: current });

        if (check.error) return reject(toErrorCode(check.error));
    }

    const { error } = await supabase.auth.updateUser({ password });

    return error ? reject(toErrorCode(error)) : { ok: true, session: getSession() };
}

async function updateProfile(session: Session, row: Record<string, unknown>) {
    const { data, error } = await supabase.from('profiles').update(row).eq('id', session.id).select(PROFILE_COLUMNS).single();

    if (error) {
        const code: SessionErrorCode = error.code === CHECK_VIOLATION ? 'rejected' : 'unavailable';

        return { code, isRefused: Boolean(error.code) };
    }

    const current = getSession();

    if (current?.id === session.id) applySession(toSession(data, current));

    return null;
}

function whenSessionReady(): Promise<Session | null> {
    if (isReady) return Promise.resolve(getSession());

    return new Promise((resolve) => {
        readyResolvers.push(resolve);
    });
}

if (typeof window !== 'undefined') {
    authLink = readAuthLink();

    if (new URLSearchParams(window.location.hash.slice(1)).has(ACCESS_TOKEN_PARAMETER)) {
        const routerState: unknown = window.history.state;

        window.addEventListener('hashchange', () => handleHashChange(routerState), { once: true });
    }

    supabase.auth.onAuthStateChange(handleAuthChange);
    window.addEventListener('storage', event => handleStorageEvent(event, syncSessionAttribute));
}

export {
    clearAuthLink,
    createAccount,
    endSession,
    getAuthLink,
    getSession,
    onSessionChange,
    requestPasswordReset,
    saveSession,
    saveTrack,
    sendSignInLink,
    startSession,
    syncSessionAttribute,
    updatePassword,
    whenSessionReady,
};
