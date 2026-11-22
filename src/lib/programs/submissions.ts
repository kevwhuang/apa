import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import {
    CANCELED_MESSAGE,
    DUPLICATE_FILE_MESSAGE,
    LOCALE,
    MILLISECONDS_PER_SECOND,
    PERMISSION_DENIED,
    SIGNED_URL_SECONDS,
    STORAGE,
    STORAGE_BUCKETS,
    TRACK_CONTENT_TYPES,
    UNIQUE_VIOLATION,
} from '@lib/shared/constants';
import { applySwitch, isSwitchOpen, loadSwitches } from '@lib/programs/switches';
import { createLiveList } from '@lib/shared/live';
import { createStore } from '@lib/shared/state';
import { getExtension } from '@lib/audio/uploads';
import { getSession, onSessionChange } from '@lib/account/session';
import { isRecord, isTrackExtension } from '@lib/shared/utils';
import { supabase } from '@lib/shared/supabase';

import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';

interface BoardFeed {
    channel: RealtimeChannel | null;
    list: LiveList<BoardEntry>;
    userId: string;
}

interface PathRow {
    storage_path: null | string;
}

interface UploadTarget {
    contentType: string;
    id: string;
    path: string;
    userId: string;
}

const BOARDS = ['assembly', 'bash'] as const;
const BOARD_COLUMNS = 'id, event_id, user_id, producer_name, link_url, file_name, file_bytes, storage_path, created_at';
const BOARD_LIMIT = 200;
const BOARD_PAGE_SIZE = 10;
const CLEAR_MESSAGE = 'The board could not be cleared. Try again.';
const EMPTY_BOARD: BoardState = { entries: [], eventId: '', status: 'idle' };

const ERROR_CODES: Partial<Record<string, SubmissionErrorCode>> = {
    intake_closed: 'closed',
    submission_limit: 'limit',
};

const HTTP_OK = 200;

const MESSAGES: Record<SubmissionErrorCode, string> = {
    'canceled': CANCELED_MESSAGE,
    'closed': 'Submissions are closed.',
    'duplicate-file': DUPLICATE_FILE_MESSAGE,
    'duplicate-link': 'That link is already on the list.',
    'limit': 'You can submit up to 3 tracks per event. Remove one to add another.',
    'signed-out': 'Sign in to submit your track.',
    'transfer': 'Transfer failed. Remove the file and try again.',
    'unavailable': 'That could not be submitted. Try again.',
};

const PATHS_PER_REMOVE = 100;
const REMOVE_FAILURE: SubmissionResult = { code: 'unavailable', message: 'That submission could not be removed. Try again.', ok: false };
const SUBMISSION_CACHE_SECONDS = 31_536_000;
const SUBMISSION_LIMIT = 3;

const feeds: Record<IntakeBoard, BoardFeed> = {
    assembly: createFeed('assembly'),
    bash: createFeed('bash'),
};

const pendingSends: Record<IntakeBoard, Set<string>> = { assembly: new Set(), bash: new Set() };
const signedTracks = new Map<string, SignedTrack>();

const store = createStore<Record<IntakeBoard, BoardState>>({
    fallback: { assembly: EMPTY_BOARD, bash: EMPTY_BOARD },
    key: STORAGE.boards.key,
    scope: STORAGE.boards.scope,
    topic: STORAGE.boards.topic,
});

async function clearSubmissions(board: IntakeBoard): Promise<ClearResult> {
    const { data, error } = await supabase.from('submissions').delete().eq('board', board).select('storage_path');

    if (error) return { message: CLEAR_MESSAGE, ok: false };

    const rows: PathRow[] = data;

    await removeTracks(rows.flatMap(row => row.storage_path ?? []));
    await removeOrphans();

    return { cleared: rows.length, ok: true };
}

async function countSubmissions(board: IntakeBoard): Promise<null | number> {
    const { count, error } = await supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('board', board);

    return error ? null : count ?? 0;
}

function createFeed(board: IntakeBoard) {
    return {
        channel: null,
        list: createLiveList({
            fetchPage: () => fetchBoard(board),
            getStamp: entry => entry.submittedAt,
            limit: BOARD_LIMIT,
            onChange: entries => writeBoard(board, { entries }),
            pageSize: BOARD_LIMIT,
        }),
        userId: '',
    };
}

function describeBoard(page: number, total: number): string {
    if (total === 0) return '';

    const first = (page - 1) * BOARD_PAGE_SIZE + 1;
    const last = Math.min(total, page * BOARD_PAGE_SIZE);

    const range = first === last ? first.toLocaleString(LOCALE) : `${first.toLocaleString(LOCALE)}\u2013${last.toLocaleString(LOCALE)}`;

    return `${range} of ${total.toLocaleString(LOCALE)}`;
}

async function fetchBoard(board: IntakeBoard) {
    const { userId } = feeds[board];

    const result = await queryBoard(board, userId);

    if (feeds[board].userId !== userId) return null;

    if (!result) {
        if (getBoard(board).status !== 'ready') writeBoard(board, { status: 'failed' });

        return null;
    }

    writeBoard(board, { eventId: result.eventId, status: 'ready' });

    return result.entries;
}

function findEntry(id: string) {
    for (const board of BOARDS) {
        const entry = getBoard(board).entries.find(item => item.id === id);

        if (entry) return { board, entry };
    }

    return null;
}

function findRefusal(board: IntakeBoard) {
    const { entries, eventId, status } = getBoard(board);

    const held = entries.filter(entry => entry.self).length + pendingSends[board].size;

    if (!isSwitchOpen(`${board}_intake`)) return 'closed';
    if (!eventId) return status === 'ready' ? 'closed' : 'unavailable';
    if (held >= SUBMISSION_LIMIT) return 'limit';

    return null;
}

function getBoard(board: IntakeBoard): BoardState {
    return store.get()[board];
}

async function getFailureCode(board: IntakeBoard, fallback: SubmissionErrorCode) {
    refreshBoard(board);

    await loadSwitches();

    return isSwitchOpen(`${board}_intake`) ? fallback : 'closed';
}

function handleCreated(board: IntakeBoard, payload: unknown) {
    const { eventId, status } = getBoard(board);
    const { list, userId } = feeds[board];

    const entry = isRecord(payload) ? toBoardEntry(payload, userId) : null;

    if (!entry || pendingSends[board].has(entry.id)) return;

    if (status === 'failed' || (status === 'ready' && entry.eventId !== eventId)) {
        void list.revalidate();

        return;
    }

    list.upsert(entry);
}

function handleSessionChange() {
    BOARDS.forEach((board) => {
        if (feeds[board].userId) watchBoard(board);
    });
}

function handleStatus(board: IntakeBoard, status: REALTIME_SUBSCRIBE_STATES) {
    const isJoined = status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
    const isWaiting = getBoard(board).status === 'loading' && status !== REALTIME_SUBSCRIBE_STATES.CLOSED;

    if (isJoined) void loadSwitches();
    if (isJoined || isWaiting) void feeds[board].list.revalidate();
}

function handleSwitchChanged(payload: unknown) {
    if (!isRecord(payload)) return;

    const { id, is_open: isOpen } = payload;

    if (typeof isOpen !== 'boolean') return;

    if (id === 'assembly_intake' || id === 'bash_intake') applySwitch(id, isOpen);
}

function onBoardChange(callback: () => void): () => void {
    return store.onChange(callback);
}

function putFile(url: string, file: File, contentType: string, options: UploadOptions) {
    return new Promise<boolean>((resolve) => {
        const request = new XMLHttpRequest();

        options.signal.addEventListener('abort', () => request.abort(), { once: true });
        request.addEventListener('abort', () => resolve(false));
        request.addEventListener('error', () => resolve(false));
        request.addEventListener('load', () => resolve(request.status === HTTP_OK));
        request.upload.addEventListener('progress', event => options.onProgress?.(event.loaded, event.total || file.size));
        request.open('PUT', url);
        request.setRequestHeader('cache-control', `max-age=${SUBMISSION_CACHE_SECONDS}`);
        request.setRequestHeader('content-type', contentType);
        request.setRequestHeader('x-upsert', 'false');
        request.send(file.slice(0, file.size, contentType));
    });
}

async function queryBoard(board: IntakeBoard, userId: string) {
    const current = await supabase.rpc('current_event_id', { p_board: board });

    if (current.error) return null;

    const eventId = typeof current.data === 'string' ? current.data : '';

    if (!eventId) return { entries: [], eventId };

    const { data, error } = await supabase
        .from('submissions')
        .select(BOARD_COLUMNS)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(BOARD_LIMIT);

    if (error) return null;

    const rows: Record<string, unknown>[] = data;

    return { entries: rows.flatMap(row => toBoardEntry(row, userId) ?? []), eventId };
}

function refreshBoard(board: IntakeBoard) {
    if (feeds[board].userId && isSwitchOpen(`${board}_intake`)) void feeds[board].list.revalidate();
}

function reject(code: SubmissionErrorCode): SubmissionResult {
    return { code, message: MESSAGES[code], ok: false };
}

async function removeOrphans(): Promise<void> {
    const { data, error } = await supabase.rpc('get_orphan_tracks');

    if (error || !Array.isArray(data)) return;

    await removeTracks(data.filter(name => typeof name === 'string'));
}

async function removeSubmission(id: string): Promise<SubmissionResult> {
    const found = findEntry(id);

    if (!found) return REMOVE_FAILURE;

    return withdraw(found.board, id, found.entry.path);
}

async function removeTracks(paths: string[]) {
    const bucket = supabase.storage.from(STORAGE_BUCKETS.tracks);

    for (let start = 0; start < paths.length; start += PATHS_PER_REMOVE) {
        const { error } = await bucket.remove(paths.slice(start, start + PATHS_PER_REMOVE));

        if (error) return;
    }
}

async function sendFile(board: IntakeBoard, file: File, target: UploadTarget, options: UploadOptions): Promise<SubmissionResult> {
    const bucket = supabase.storage.from(STORAGE_BUCKETS.tracks);
    const { contentType, id, path, userId } = target;

    if (options.signal.aborted) return reject('canceled');

    const signed = await bucket.createSignedUploadUrl(path);

    if (signed.error) return reject(await getFailureCode(board, 'unavailable'));

    if (options.signal.aborted) return reject('canceled');

    const isSent = await putFile(signed.data.signedUrl, file, contentType, options);

    if (!isSent) {
        void bucket.remove([path]);

        return reject(options.signal.aborted ? 'canceled' : await getFailureCode(board, 'transfer'));
    }

    const { data, error } = await supabase.from('submissions').insert({ board, file_name: file.name, id }).select(BOARD_COLUMNS).single();

    if (error) {
        const cleared = error.code ? null : await supabase.from('submissions').delete().eq('id', id);

        if (!cleared?.error) void bucket.remove([path]);

        return reject(toErrorCode(error, 'duplicate-file'));
    }

    if (options.signal.aborted) {
        void withdraw(board, id, path);

        return reject('canceled');
    }

    const entry = toBoardEntry(data, userId);

    if (entry) feeds[board].list.upsert(entry);

    return { id, ok: true };
}

async function signSubmission(entry: BoardEntry): Promise<null | string> {
    const cached = signedTracks.get(entry.id);

    if (cached && cached.expiresAt > Date.now()) return cached.url;
    if (!entry.path) return null;

    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.tracks).createSignedUrl(entry.path, SIGNED_URL_SECONDS);

    if (error) return null;

    signedTracks.set(entry.id, { expiresAt: Date.now() + SIGNED_URL_SECONDS * MILLISECONDS_PER_SECOND, url: data.signedUrl });

    return data.signedUrl;
}

async function startFeed(board: IntakeBoard, userId: string) {
    const feed = feeds[board];

    feed.userId = userId;
    writeBoard(board, { status: 'loading' });

    try {
        await supabase.realtime.setAuth();
    } catch {
        stopFeed(board);
        writeBoard(board, { status: 'failed' });

        return;
    }

    if (feed.channel || feed.userId !== userId) return;

    feed.channel = supabase
        .channel(`board:${board}`, { config: { private: true } })
        .on('broadcast', { event: 'submission_created' }, message => handleCreated(board, message.payload))
        .on('broadcast', { event: 'submission_deleted' }, ({ payload }) => {
            if (isRecord(payload) && typeof payload.id === 'string') feeds[board].list.remove(payload.id);
        })
        .on('broadcast', { event: 'switch_changed' }, message => handleSwitchChanged(message.payload))
        .subscribe(status => handleStatus(board, status));
}

function stopFeed(board: IntakeBoard) {
    const feed = feeds[board];

    if (feed.channel) void supabase.removeChannel(feed.channel);

    feed.channel = null;
    feed.userId = '';
    feed.list.reset();
    writeBoard(board, EMPTY_BOARD);
}

async function submitFile(board: IntakeBoard, file: File, options: UploadOptions): Promise<SubmissionResult> {
    const extension = getExtension(file.name);
    const session = getSession();

    if (!session) return reject('signed-out');

    const refusal = findRefusal(board);

    if (refusal) {
        refreshBoard(board);

        return reject(refusal);
    }

    if (!isTrackExtension(extension)) return reject('unavailable');

    const id = crypto.randomUUID();

    const target = {
        contentType: TRACK_CONTENT_TYPES[extension],
        id,
        path: `${session.id}/${getBoard(board).eventId}/${id}.${extension}`,
        userId: session.id,
    };

    pendingSends[board].add(id);

    const result = await sendFile(board, file, target, options);

    pendingSends[board].delete(id);

    return result;
}

async function submitLink(board: IntakeBoard, link: TrackLink): Promise<SubmissionResult> {
    const session = getSession();

    if (!session) return reject('signed-out');

    const isDuplicate = getBoard(board).entries.some(entry => entry.href === link.href && entry.self);
    const refusal = findRefusal(board);

    if (refusal) {
        refreshBoard(board);

        return reject(refusal);
    }

    if (isDuplicate) return reject('duplicate-link');

    const { data, error } = await supabase.from('submissions').insert({ board, id: link.id, link_url: link.href }).select(BOARD_COLUMNS).single();

    const stored = error && !error.code
        ? await supabase.from('submissions').select(BOARD_COLUMNS).eq('id', link.id).retry(false).maybeSingle()
        : null;

    const row = stored?.data ?? data;

    if (!row) {
        const code = error ? toErrorCode(error, 'duplicate-link') : 'unavailable';

        if (code === 'closed') void loadSwitches();

        return reject(code);
    }

    const entry = toBoardEntry(row, session.id);

    if (entry) feeds[board].list.upsert(entry);

    return { id: link.id, ok: true };
}

function toBoardEntry(row: Record<string, unknown>, userId: string) {
    const { event_id: eventId, id, producer_name: producer, user_id: owner } = row;
    const href = typeof row.link_url === 'string' ? row.link_url : '';
    const name = typeof row.file_name === 'string' ? row.file_name : '';
    const submittedAt = Date.parse(String(row.created_at ?? ''));

    if (typeof eventId !== 'string' || typeof id !== 'string' || typeof owner !== 'string' || typeof producer !== 'string') return null;
    if (!Number.isFinite(submittedAt) || (!href && !name)) return null;

    return {
        bytes: Number(row.file_bytes) || 0,
        eventId,
        href,
        id,
        path: typeof row.storage_path === 'string' ? row.storage_path : '',
        producer,
        self: owner === userId,
        source: href ? href.replace(/^https:\/\//, '') : name,
        submittedAt,
        userId: owner,
    };
}

function toErrorCode(error: PostgrestError, duplicate: SubmissionErrorCode) {
    if (error.code === UNIQUE_VIOLATION) return duplicate;
    if (error.code === PERMISSION_DENIED) return 'signed-out';

    return ERROR_CODES[error.message] ?? 'unavailable';
}

function watchBoard(board: IntakeBoard): void {
    const userId = getSession()?.id ?? '';

    if (feeds[board].userId === userId) {
        if (userId && getBoard(board).status === 'failed') {
            writeBoard(board, { status: 'loading' });
            void feeds[board].list.revalidate();
        }

        return;
    }

    stopFeed(board);

    if (userId) void startFeed(board, userId);
}

async function withdraw(board: IntakeBoard, id: string, path: string): Promise<SubmissionResult> {
    const { count, error } = await supabase.from('submissions').delete({ count: 'exact' }).eq('id', id);

    const lookup = error && !error.code
        ? await supabase.from('submissions').select('id').eq('id', id).retry(false).maybeSingle()
        : null;

    const isGone = lookup ? !lookup.error && lookup.data === null : !error && count === 1;

    if (!isGone) return REMOVE_FAILURE;

    feeds[board].list.remove(id);

    if (path) void supabase.storage.from(STORAGE_BUCKETS.tracks).remove([path]);

    return { id, ok: true };
}

function writeBoard(board: IntakeBoard, patch: Partial<BoardState>) {
    store.update(value => ({ ...value, [board]: { ...value[board], ...patch } }));
}

if (typeof window !== 'undefined') onSessionChange(handleSessionChange);

export {
    BOARD_PAGE_SIZE,
    clearSubmissions,
    countSubmissions,
    describeBoard,
    getBoard,
    onBoardChange,
    removeOrphans,
    removeSubmission,
    signSubmission,
    submitFile,
    submitLink,
    watchBoard,
};
