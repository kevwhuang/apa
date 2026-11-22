import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import { CHAT_MESSAGE_MAX_LENGTH, CHECK_VIOLATION, STORAGE, UNIQUE_VIOLATION } from '@lib/shared/constants';
import { createLiveList } from '@lib/shared/live';
import { createStore } from '@lib/shared/state';
import { getSession } from '@lib/account/session';
import { isRecord } from '@lib/shared/utils';
import { supabase } from '@lib/shared/supabase';

import type { RealtimeChannel } from '@supabase/supabase-js';

const CHAT_COLUMNS = 'id, user_id, author_name, body, created_at';
const CHAT_HISTORY_LIMIT = 200;
const CHAT_PAGE_SIZE = 50;
const CHAT_TOPIC = 'chat:global';
const FALLBACK: ChatState = { messages: [], online: 0, open: false };

const MESSAGES: Record<ChatErrorCode, string> = {
    'rate-limited': 'You are sending messages too quickly. Wait a moment and try again.',
    'send-failed': 'That message was not sent. Try again.',
    'signed-out': 'Sign in to send a message.',
    'too-long': `Use ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer.`,
};

const RATE_LIMIT_CODE = 'chat_rate_limited';

const list = createLiveList<ChatMessage>({
    fetchPage,
    getStamp: message => message.sentAt,
    limit: CHAT_HISTORY_LIMIT,
    onChange: messages => store.set({ ...store.get(), messages }),
    pageSize: CHAT_PAGE_SIZE,
});

const store = createStore<ChatState>({
    fallback: FALLBACK,
    key: STORAGE.chat.key,
    scope: STORAGE.chat.scope,
    topic: STORAGE.chat.topic,
});

let channel: RealtimeChannel | undefined;
let hasEarlier = false;
let hasHistory = false;
let isLoadingEarlier = false;
let isWanted = false;
let joinedUserId = '';
let oldestCreatedAt = '';
let unsent: Pick<ChatMessage, 'body' | 'id' | 'userId'> | undefined;

function closeChat(): void {
    store.set({ ...store.get(), open: false });
}

function connectChat(): void {
    const userId = getSession()?.id ?? '';

    if (!isWanted) return;

    if (userId === joinedUserId) {
        if (userId && !hasHistory) void list.revalidate();

        return;
    }

    leave();
    joinedUserId = userId;

    if (userId) void join(userId);
}

async function fetchPage() {
    const userId = joinedUserId;

    const { data, error } = await supabase.from('chat_messages').select(CHAT_COLUMNS).order('created_at', { ascending: false }).limit(CHAT_PAGE_SIZE);

    if (error || userId !== joinedUserId) return null;

    const rows: Record<string, unknown>[] = data;

    if (!oldestCreatedAt || rows.length < CHAT_PAGE_SIZE) {
        hasEarlier = rows.length === CHAT_PAGE_SIZE;
        oldestCreatedAt = toCursor(rows);
    }

    hasHistory = true;

    return toChatMessages(rows);
}

function getChatState(): ChatState {
    return store.get();
}

function getMessages(): ChatMessage[] {
    return store.get().messages;
}

function handleCreated(payload: unknown) {
    const message = toChatMessage(payload);

    if (message) list.upsert(message);
}

function handlePresence() {
    if (channel) store.set({ ...store.get(), online: Object.keys(channel.presenceState()).length });
}

function handleStatus(status: REALTIME_SUBSCRIBE_STATES) {
    const isJoined = status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
    const isWaiting = !hasHistory && status !== REALTIME_SUBSCRIBE_STATES.CLOSED;

    if (isJoined) void channel?.track({});
    if (isJoined || isWaiting) void list.revalidate();
}

function hasEarlierMessages(): boolean {
    return hasEarlier && !isLoadingEarlier;
}

async function join(userId: string) {
    try {
        await supabase.realtime.setAuth();
    } catch {
        if (joinedUserId === userId) joinedUserId = '';

        return;
    }

    if (channel || joinedUserId !== userId) return;

    channel = supabase
        .channel(CHAT_TOPIC, { config: { presence: { key: userId }, private: true } })
        .on('broadcast', { event: 'message_created' }, message => handleCreated(message.payload))
        .on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
            if (isRecord(payload) && typeof payload.id === 'string') list.remove(payload.id);
        })
        .on('presence', { event: 'sync' }, handlePresence)
        .subscribe(handleStatus);
}

function leave() {
    if (channel) void supabase.removeChannel(channel);

    channel = undefined;
    hasEarlier = false;
    hasHistory = false;
    oldestCreatedAt = '';
    list.reset();
    store.set({ ...store.get(), online: 0 });
}

async function loadEarlierMessages(): Promise<void> {
    if (!hasEarlierMessages()) return;

    const cursor = oldestCreatedAt;
    const userId = joinedUserId;

    isLoadingEarlier = true;

    const { data, error } = await supabase
        .from('chat_messages')
        .select(CHAT_COLUMNS)
        .lt('created_at', cursor)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

    isLoadingEarlier = false;

    if (error || userId !== joinedUserId) return;

    const rows: Record<string, unknown>[] = data;

    list.merge(toChatMessages(rows));
    hasEarlier = getMessages().length < CHAT_HISTORY_LIMIT && rows.length === CHAT_PAGE_SIZE;
    oldestCreatedAt = toCursor(rows) || cursor;
}

function onChatChange(callback: (state: ChatState) => void): () => void {
    return store.onChange(callback);
}

function openChat(): void {
    isWanted = true;
    store.set({ ...store.get(), open: true });
    connectChat();
}

function reject(code: ChatErrorCode): ChatResult {
    return { code, message: MESSAGES[code], ok: false };
}

async function sendChatMessage(body: string): Promise<ChatResult> {
    const session = getSession();

    if (!session) return reject('signed-out');
    if (body.length > CHAT_MESSAGE_MAX_LENGTH) return reject('too-long');

    const id = unsent?.body === body && unsent.userId === session.id ? unsent.id : crypto.randomUUID();

    list.upsert({ body, id, name: session.artistName, self: true, sentAt: Date.now(), userId: session.id });

    const { data, error } = await supabase.from('chat_messages').insert({ body, id }).select(CHAT_COLUMNS).single();

    const isDuplicate = error?.code === UNIQUE_VIOLATION;
    const isUnknown = error !== null && !error.code;

    const stored = isDuplicate || isUnknown
        ? await supabase.from('chat_messages').select(CHAT_COLUMNS).eq('id', id).retry(false).maybeSingle()
        : null;

    const sent = toChatMessage(stored?.data ?? data);

    if (!sent) {
        list.discard(id);

        if (isUnknown) unsent = { body, id, userId: session.id };

        if (error?.message === RATE_LIMIT_CODE) return reject('rate-limited');

        return reject(error?.code === CHECK_VIOLATION ? 'too-long' : 'send-failed');
    }

    unsent = undefined;
    list.upsert(sent);

    return { ok: true };
}

function toChatMessage(row: unknown): ChatMessage | null {
    if (!isRecord(row)) return null;

    const { author_name: name, body, created_at: createdAt, id, user_id: userId } = row;

    const sentAt = typeof createdAt === 'string' ? Date.parse(createdAt) : Number.NaN;

    if (typeof body !== 'string' || typeof id !== 'string' || typeof name !== 'string' || typeof userId !== 'string') return null;
    if (!Number.isFinite(sentAt)) return null;

    return { body, id, name, self: userId === joinedUserId, sentAt, userId };
}

function toChatMessages(rows: Record<string, unknown>[]) {
    return rows
        .map(toChatMessage)
        .filter(message => message !== null);
}

function toCursor(rows: Record<string, unknown>[]) {
    const oldest = rows.at(-1)?.created_at;

    return typeof oldest === 'string' ? oldest : '';
}

export {
    closeChat,
    connectChat,
    getChatState,
    getMessages,
    hasEarlierMessages,
    loadEarlierMessages,
    onChatChange,
    openChat,
    sendChatMessage,
};
