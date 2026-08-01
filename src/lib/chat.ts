import { MOCK_LATENCY_MS, STORAGE } from '@lib/constants';
import { createStore } from '@lib/state';
import { delay } from '@lib/utils';

export const CHAT_OPENERS = [
    'Hey \u2014 saw you at the last Assembly. Want to trade stems this week?',
    'That loop you played at the Hangout is still stuck in my head. What did you track it on?',
    'I have a session booked and a spare pair of ears going. Interested?',
];

export const CHAT_PREVIEW: ChatMessage[] = [
    { author: 'you', body: 'For sure. I can bounce stems tonight after work.', sentAt: 0 },
    { author: 'member', body: 'Perfect. Drop them here and I will take a first pass.', sentAt: 0 },
];

const CHAT_REPLIES = [
    'Sounds good. Send it over whenever it is ready and I will take a pass.',
    'I can do the back half of the week. Mornings are better for me than nights.',
    'Bring it to the next Assembly and we can listen through it on the big system.',
    'Noted. I will follow up here once I have had a proper listen.',
];

const store = createStore<ChatState>({
    fallback: { open: false, threadId: '', threads: {} },
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

export function getMessages(threadId: string): ChatMessage[] {
    return store.get().threads[threadId] ?? [];
}

function normalizeChat(value: ChatState) {
    if (typeof value !== 'object' || value === null) return { open: false, threadId: '', threads: {} };

    const threads: Record<string, ChatMessage[]> = {};

    for (const [id, messages] of Object.entries(value.threads ?? {})) {
        if (!Array.isArray(messages)) continue;

        threads[id] = messages
            .filter(message => typeof message?.body === 'string')
            .map(message => ({
                author: message.author === 'you' ? 'you' : 'member',
                body: message.body,
                sentAt: Number(message.sentAt) || 0,
            }));
    }

    return {
        open: value.open === true,
        threadId: String(value.threadId ?? ''),
        threads,
    };
}

export function onChatChange(callback: (state: ChatState) => void): () => void {
    return store.onChange(callback);
}

export function openChat(): void {
    store.set({ ...store.get(), open: true });
}

export function selectThread(threadId: string): void {
    store.set({ ...store.get(), threadId });
}

export async function sendChatMessage(threadId: string, body: string): Promise<ChatMessage | null> {
    const text = body.trim();

    if (!text) return null;

    const sent: ChatMessage = { author: 'you', body: text, sentAt: Date.now() };

    store.update(state => ({
        ...state,
        threads: { ...state.threads, [threadId]: [...(state.threads[threadId] ?? []), sent] },
    }));

    await delay(MOCK_LATENCY_MS);

    const sentCount = getMessages(threadId).filter(message => message.author === 'you').length;
    const reply: ChatMessage = {
        author: 'member',
        body: CHAT_REPLIES[Math.min(sentCount - 1, CHAT_REPLIES.length - 1)],
        sentAt: Date.now(),
    };

    store.update(state => ({
        ...state,
        threads: { ...state.threads, [threadId]: [...(state.threads[threadId] ?? []), reply] },
    }));

    return reply;
}
