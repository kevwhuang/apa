import { MOCK_LATENCY_MS, STORAGE } from '@lib/constants';
import { createStore } from '@lib/state';
import { delay } from '@lib/utils';

const CHAT_REPLIES = [
    'Sounds good. Drop it in here whenever it is ready and I will take a pass.',
    'I can do the back half of the week. Mornings are better for me than nights.',
    'Bring it to the next Assembly and the room can listen through it on the big system.',
    'Noted. I will follow up here once I have had a proper listen.',
];

const FALLBACK: ChatState = { messages: [], open: false };

const ONLINE_WINDOW_MS = 900_000;

export const ROOM_MEMBERS = [
    { line: 'Anyone got stems to trade this week? I have a beat that needs a second pair of hands on it.', name: 'Devon Park' },
    { line: 'That loop Devon closed the Hangout with is still stuck in my head. What did you track it on?', name: 'Inez Rao' },
    { line: 'I have a session booked Thursday and a spare pair of ears going. Open invite to the room.', name: 'June Castillo' },
] as const;

const SEED_OFFSETS_MS = [780_000, 540_000, 240_000];

const SELF_NAME = 'You';

const store = createStore<ChatState>({
    fallback: FALLBACK,
    key: STORAGE.chat.key,
    normalize: normalizeChat,
    scope: STORAGE.chat.scope,
    topic: STORAGE.chat.topic,
});

export function closeChat(): void {
    store.set({ ...store.get(), open: false });
}

export function getChatState(): ChatState {
    return store.get();
}

export function getMessages(): ChatMessage[] {
    return store.get().messages;
}

export function getOnlineCount(nowMs: number): number {
    const cutoff = nowMs - ONLINE_WINDOW_MS;
    const names = new Set<string>();

    for (const message of store.get().messages) {
        if (message.sentAt >= cutoff) names.add(message.name);
    }

    return names.size;
}

function normalizeChat(value: ChatState): ChatState {
    if (typeof value !== 'object' || value === null || !Array.isArray(value.messages)) return { messages: [], open: false };

    return {
        messages: value.messages
            .filter(message => typeof message?.body === 'string')
            .map(message => ({
                body: message.body,
                name: String(message.name ?? ''),
                self: message.self === true,
                sentAt: Number(message.sentAt) || 0,
            })),
        open: value.open === true,
    };
}

export function onChatChange(callback: (state: ChatState) => void): () => void {
    return store.onChange(callback);
}

export function openChat(): void {
    store.set({ ...store.get(), open: true });
}

export function seedRoom(): void {
    const state = store.get();

    if (state.messages.length > 0) return;

    const now = Date.now();

    store.set({
        ...state,
        messages: ROOM_MEMBERS.map((member, index) => ({
            body: member.line,
            name: member.name,
            self: false,
            sentAt: now - SEED_OFFSETS_MS[index],
        })),
    });
}

export async function sendChatMessage(body: string): Promise<ChatMessage | null> {
    const text = body.trim();

    if (!text) return null;

    const sent: ChatMessage = { body: text, name: SELF_NAME, self: true, sentAt: Date.now() };

    store.update(state => ({ ...state, messages: [...state.messages, sent] }));

    const turn = getMessages().filter(message => message.self).length - 1;

    await delay(MOCK_LATENCY_MS);

    const reply: ChatMessage = {
        body: CHAT_REPLIES[turn % CHAT_REPLIES.length],
        name: ROOM_MEMBERS[turn % ROOM_MEMBERS.length].name,
        self: false,
        sentAt: Date.now(),
    };

    store.update(state => ({ ...state, messages: [...state.messages, reply] }));

    return reply;
}
