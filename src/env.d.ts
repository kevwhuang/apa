/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type AssetKind = (typeof import('@lib/constants').ASSET_KINDS)[number];

type CartIssueKind = 'out-of-stock' | 'price-changed' | 'quantity-reduced' | 'removed';

type ChatAuthor = 'member' | 'you';

type EventCadence = (typeof import('@lib/constants').EVENT_CADENCES)[number];

type EventStatus = (typeof import('@lib/constants').EVENT_STATUSES)[number];

type EventType = (typeof import('@lib/constants').EVENT_TYPES)[number];

type FieldErrors = Record<string, string>;

interface ImportMetaEnv {
    readonly SUPABASE_PUBLISHABLE_KEY: string;
    readonly SUPABASE_URL: string;
}

type MotionBezier = [number, number, number, number];

type MotionDurationToken = 'base' | 'cinematic' | 'fast' | 'slow' | 'slower' | 'slowest';

type MotionEase = (progress: number) => number;

type MotionEaseToken = 'entrance' | 'linear' | 'mechanical' | 'snap' | 'standard';

type MotionPresetName = 'rise' | 'rule' | 'stamp' | 'strike' | 'unfold';

type MotionStaggerToken = 'base' | 'tight';

type OnboardingGate = { email: string; state: 'granted'; token: OnboardingToken } | { reason: OnboardingRejection; state: 'rejected' };

type OnboardingRejection = 'completed' | 'expired' | 'malformed' | 'missing';

type OrderResult = { code: PaymentErrorCode; message: string; ok: false } | { ok: true; order: Order };

type PaymentErrorCode = 'card-declined' | 'cart-changed' | 'empty-cart';

type ProducerAvailability = (typeof import('@lib/constants').PRODUCER_AVAILABILITIES)[number];

type ProductCategory = (typeof import('@lib/constants').PRODUCT_CATEGORIES)[number];

type ProgramState = 'active' | 'planned';

type SandboxKind = 'chorus' | 'compressor' | 'delay' | 'eq' | 'filter' | 'gate' | 'limiter' | 'meter' | 'rack' | 'reverb' | 'saturator' | 'tuner';

type SessionErrorCode = 'already-registered' | 'invalid-credentials' | 'invalid-email' | 'weak-password';

type SessionResult = { code: SessionErrorCode; message: string; ok: false } | { ok: true; session: Session };

type StorageScope = 'local' | 'memory' | 'session';

type Timer = ReturnType<typeof setInterval>;

type UploadResult = { entry: UploadEntry; ok: true } | { message: string; ok: false };

type UploadStatus = 'failed' | 'queued' | 'reading' | 'ready' | 'rejected';

interface BashSubmission {
    edition: string;
    producer: string;
    submittedAt: string;
    title: string;
}

interface Calendar {
    past: CalendarEvent[];
    upcoming: CalendarEvent[];
}

interface CalendarEvent {
    date: Date;
    excerpt: string;
    id: string;
    location: string;
    status: EventStatus;
    title: string;
    type: EventType;
}

interface CartIssue {
    from?: number;
    kind: CartIssueKind;
    title: string;
    to?: number;
}

interface CartItem {
    color?: string;
    image: string;
    priceCents: number;
    productSlug: string;
    quantity: number;
    size?: string;
    title: string;
}

interface CartTotals {
    discountCents: number;
    shippingCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
}

interface CatalogEntry {
    priceCents: number;
    slug: string;
    stock: number;
    title: string;
}

interface ChatMessage {
    author: ChatAuthor;
    body: string;
    sentAt: number;
}

interface ChatState {
    open: boolean;
    threadId: string;
    threads: Record<string, ChatMessage[]>;
}

interface ContactEmailInput {
    email: string;
    message: string;
    name: string;
    topic: string;
}

interface EventProgram {
    cadence: EventCadence;
    name: string;
    shortName: string;
    state: ProgramState;
    summary: string;
}

interface FieldRule {
    max?: number;
    message: string;
    min?: number;
    pattern?: RegExp;
    required?: boolean;
    validate?: (value: string, values: FormData) => boolean;
}

interface MockEmail {
    actionHref: string;
    actionLabel: string;
    body: string[];
    from: string;
    preheader: string;
    replyTo: string;
    subject: string;
    to: string;
}

interface MotionBridge {
    arm: () => void;
    armedClass: string;
    disarm: () => void;
    expired: boolean;
    live: () => boolean;
}

interface MotionPreset {
    duration: MotionDurationToken;
    ease: MotionEaseToken;
    from: (tokens: MotionTokens) => gsap.TweenVars;
    stagger: MotionStaggerToken;
    to: () => gsap.TweenVars;
}

interface MotionRoot {
    preset: MotionPresetName;
    targets: Element[];
}

interface MotionTokens {
    alphaMax: number;
    duration: Record<MotionDurationToken, number>;
    ease: Record<MotionEaseToken, MotionEase>;
    stagger: Record<MotionStaggerToken, number>;
    staggerMaxTotal: number;
    travel: number;
    travelLarge: number;
    velocityCap: number;
}

interface OnboardingDraft {
    answers: Record<string, string[]>;
    displayName: string;
    email: string;
    genres: string[];
    location: string;
    passwordSet: boolean;
    step: number;
    username: string;
}

interface OnboardingEmailInput {
    email: string;
    eventName?: string;
    prods: number;
    token: string;
}

interface OnboardingToken {
    email: string;
    issuedAt: number;
    nonce: string;
}

interface Order {
    email: string;
    id: string;
    items: CartItem[];
    placedAt: number;
    totals: CartTotals;
}

interface OrderInput {
    cardNumber: string;
    email: string;
    items: CartItem[];
    prodsApplied: number;
}

interface PlayerState {
    open: boolean;
    playing: boolean;
    position: number;
}

interface PlayerTrack {
    artist: string;
    durationSeconds: number;
    id: string;
    title: string;
}

interface ProducerRecord extends Omit<import('astro:content').CollectionEntry<'producers'>['data'], 'avatar' | 'joined'> {
    avatar: string | null;
    id: string;
    joined: string;
}

interface SandboxBlock {
    analyser?: AnalyserNode;
    dispose(): void;
    flushTails?(): void;
    input: AudioNode;
    output: AudioNode;
    restoreTails?(): void;
    setParam(name: string, value: number): void;
    setStage?(name: string, enabled: boolean): void;
    state?(): string;
    tick?(): void;
}

interface SandboxChain {
    dispose(): void;
    flushTails(): void;
    input: GainNode;
    restoreTails(): void;
    setBypass(bypassed: boolean): void;
}

interface SandboxEngine {
    createModule(kind: SandboxKind, hooks?: SandboxModuleHooks): SandboxModule;
    dispose(): void;
}

interface SandboxModule {
    block: SandboxBlock;
    bypass(bypassed: boolean): void;
    isBypassed(): boolean;
    isPlaying(): boolean;
    setBuffer(buffer: AudioBuffer): void;
    setParam(name: string, value: number): void;
    start(): void;
    stop(): void;
}

interface SandboxModuleHooks {
    onFrame?: () => void;
    onStopped?: () => void;
}

interface Session {
    createdAt: number;
    displayName: string;
    email: string;
    expiresAt: number;
    onboarded: boolean;
    prods: number;
    username: string;
}

interface SessionDraft {
    displayName?: string;
    email: string;
    password?: string;
    username?: string;
}

interface Store<T> {
    get(): T;
    onChange(callback: (value: T) => void): () => void;
    remove(): void;
    set(value: T): T;
    update(updater: (value: T) => T): T;
}

interface StoreOptions<T> {
    fallback: T;
    key: string;
    normalize?: (value: T) => T;
    scope: StorageScope;
    topic: string;
}

interface TrackState {
    playing: boolean;
    trackId: string;
}

interface UploadEntry {
    durationSeconds?: number;
    error?: string;
    file: File;
    id: string;
    loadedBytes: number;
    peaks?: Float32Array;
    status: UploadStatus;
    totalBytes: number;
}

interface UploadOptions {
    onProgress: (loadedBytes: number, totalBytes: number) => void;
    signal: AbortSignal;
}

interface Window {
    __apaMotion?: MotionBridge;
}

interface WindowEventMap {
    'apa:track-play': CustomEvent<{ track: PlayerTrack }>;
    'apa:track-state': CustomEvent<TrackState>;
}
