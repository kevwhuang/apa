/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type ActionResult = { message: string; ok: false } | { ok: true };
type AssetKind = (typeof import('@lib/shared/constants').ASSET_KINDS)[number];
type AuthLink = 'expired' | 'recovery';
type AvatarResult = { dataUrl: string; ok: true } | { message: string; ok: false };
type BoardStatus = 'failed' | 'idle' | 'loading' | 'ready';
type ChatErrorCode = 'rate-limited' | 'send-failed' | 'signed-out' | 'too-long';
type ChatResult = { code: ChatErrorCode; message: string; ok: false } | { ok: true };
type CheckInErrorCode = 'closed' | 'expired' | 'full' | 'invalid-email' | 'missing' | 'unavailable';
type CheckInResult = { code: CheckInErrorCode; message: string; ok: false } | { confirmed: boolean; eventId: string; ok: true; prods: null | number; repeated: boolean };
type ClearResult = { cleared: number; ok: true } | { message: string; ok: false };
type EventData = import('astro:content').CollectionEntry<'events'>['data'];
type FieldErrors = Record<string, string>;
type ImageSources = Record<string, string>;
type IntakeBoard = 'assembly' | 'bash';
type MemberRole = (typeof import('@lib/shared/constants').MEMBER_ROLES)[number];
type MotionBezier = [number, number, number, number];
type MotionDurationToken = 'base' | 'cinematic' | 'fast' | 'slow' | 'slower' | 'slowest';
type MotionEaseToken = 'entrance' | 'linear' | 'mechanical' | 'snap';
type MotionPresetName = 'blur' | 'flip' | 'rise' | 'rule' | 'stamp' | 'strike' | 'tilt' | 'unfold' | 'wipe';
type MotionScrubName = 'drift';
type MotionStaggerOrigin = 'end' | 'start';
type MotionStaggerToken = 'base' | 'tight';
type OrderResult = { code: PaymentErrorCode; message: string; ok: false } | { ok: true; order: Order };
type PaymentErrorCode = 'cart-changed' | 'empty-cart' | 'not-configured' | 'payment-failed' | 'payment-unavailable' | 'rate-limited' | 'unavailable';
type ProdsErrorCode = 'member-unknown' | 'negative' | 'not-admin' | 'unavailable';
type ProdsResult = { code: ProdsErrorCode; message: string; ok: false } | { ok: true; prods: number };
type ProfilePatch = Partial<Pick<Session, 'artistName' | 'avatar' | 'bio' | 'city' | 'genres' | 'links' | 'onboarded' | 'role' | 'state'>>;
type RackKind = 'chorus' | 'compressor' | 'delay' | 'distortion' | 'eq' | 'filter' | 'gate' | 'highpass' | 'limiter' | 'meter' | 'pan' | 'reverb' | 'saturator' | 'tremolo' | 'trim' | 'tuner';
type RackLoadResult = { buffer: AudioBuffer; ok: true } | { message: string; ok: false };
type RequestErrorCode = 'conflict' | 'network' | 'not-configured' | 'rate-limited' | 'rejected' | 'unauthorized' | 'unavailable';
type RequestResult = { code: RequestErrorCode; message: string; ok: false } | { data: Record<string, unknown>; ok: true };
type SessionErrorCode = 'already-registered' | 'email-unavailable' | 'invalid-credentials' | 'invalid-email' | 'rate-limited' | 'rejected' | 'same-password' | 'signed-out' | 'signups-closed' | 'unavailable' | 'unconfirmed' | 'upload-failed' | 'weak-password';
type SessionResult = { code: SessionErrorCode; message: string; ok: false } | { ok: true; session: Session | null };
type SiteSwitch = 'assembly_intake' | 'bash_intake' | 'check_in' | 'signups';
type Speaker = import('astro:content').CollectionEntry<'speakers'>['data'] & { bio: string };
type Sponsor = import('astro:content').CollectionEntry<'sponsors'>['data'] & { description: string };
type StorageScope = 'local' | 'memory';
type SubmissionErrorCode = 'canceled' | 'closed' | 'duplicate-file' | 'duplicate-link' | 'limit' | 'signed-out' | 'transfer' | 'unavailable';
type SubmissionResult = { code: SubmissionErrorCode; message: string; ok: false } | { id: string; ok: true };
type SwitchState = Record<SiteSwitch, boolean>;
type Theme = 'dark' | 'light';
type Timer = ReturnType<typeof setInterval>;
type ToastTone = 'error' | 'info' | 'success';
type TrackLinkResult = { link: TrackLink; ok: true } | { message: string; ok: false };
type UploadResult = { entry: UploadEntry; ok: true } | { message: string; ok: false };

interface BoardEntry {
    bytes: number;
    eventId: string;
    href: string;
    id: string;
    path: string;
    producer: string;
    self: boolean;
    source: string;
    submittedAt: number;
    userId: string;
}

interface BoardState {
    entries: BoardEntry[];
    eventId: string;
    status: BoardStatus;
}

interface CartIssue {
    from?: number;
    kind: 'out-of-stock' | 'price-changed' | 'quantity-reduced' | 'removed';
    title: string;
    to?: number;
}

interface CartItem {
    image: string;
    priceCents: number;
    productSlug: string;
    quantity: number;
    size?: string;
    sku: string;
    title: string;
    variation?: string;
}

interface CartTotals {
    discountCents: number;
    promoCents: number;
    shippingCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
}

interface CatalogEntry {
    priceCents: number;
    sizes: string[];
    sku: string;
    slug: string;
    stock: number;
    title: string;
    variations: CatalogVariation[];
}

interface CatalogVariation {
    image: string;
    name: string;
    priceCents: number;
    sku: string;
}

interface ChatMessage {
    body: string;
    id: string;
    name: string;
    self: boolean;
    sentAt: number;
    userId: string;
}

interface ChatState {
    messages: ChatMessage[];
    online: number;
    open: boolean;
}

interface ComposedEmail {
    actionHref: string;
    actionLabel: string;
    body: string[];
    from: string;
    preheader: string;
    replyTo: string;
    subject: string;
    to: string;
}

interface ContactEmailInput {
    email: string;
    message: string;
    name: string;
    topic: string;
}

interface DoorCode {
    code: string;
    eventId: string;
    secondsLeft: number;
}

interface EventRecord extends Omit<EventData, 'speaker' | 'sponsor'> {
    body: string;
    id: string;
    speaker?: Speaker;
    sponsor?: Sponsor;
}

interface FieldRule {
    max?: number;
    message: string;
    min?: number;
    pattern?: RegExp;
    required?: boolean;
    validate?: (value: string, values: FormData) => boolean;
}

interface LiveList<T> {
    discard(id: string): void;
    merge(rows: T[]): void;
    remove(id: string): void;
    reset(): void;
    revalidate(): Promise<boolean>;
    upsert(row: T): void;
}

interface MotionBridge {
    arm: () => void;
    disarm: () => void;
    expired: boolean;
    live: () => boolean;
}

interface MotionGroup {
    name: MotionPresetName;
    targets: Element[];
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

interface MotionScrubPreset {
    from: gsap.TweenVars;
    scrub: number;
    to: gsap.TweenVars;
}

interface MotionTokens {
    duration: Record<MotionDurationToken, number>;
    ease: Record<MotionEaseToken, (progress: number) => number>;
    stagger: Record<MotionStaggerToken, number>;
    staggerMaxTotal: number;
    travel: number;
}

interface OnboardingEmailInput {
    email: string;
}

interface Order {
    account: string;
    email: string;
    id: string;
    items: CartItem[];
    placedAt: number;
    totals: CartTotals;
}

interface OrderInput {
    email: string;
    items: CartItem[];
    payment: PaymentField | null;
    prodsApplied: number;
    promoCode: string;
    shipping: ShippingAddress;
}

interface PaymentField {
    confirm(clientSecret: string, returnPath: string): Promise<ActionResult>;
    destroy(): void;
    mount(container: HTMLElement): void;
    setAmount(cents: number): void;
    setReadOnly(isReadOnly: boolean): void;
    submit(): Promise<ActionResult>;
}

interface PlayerState {
    open: boolean;
    playing: boolean;
    position: number;
}

interface PlayerTrack {
    artist: string;
    durationSeconds: number;
    file?: string;
    id: string;
    seed: string;
    title: string;
}

interface ProdsAttendance {
    date: string;
    event: string;
}

interface ProdsMember {
    artistName: string;
    email: string;
    id: string;
    joined: string;
    prods: number;
}

interface ProdsRow {
    amount: number;
    date: string;
    reason: string;
    total: number;
}

interface RackAudio {
    context: AudioContext;
    input: GainNode;
    master: GainNode;
}

interface RackBlock {
    analyser?: AnalyserNode;
    dispose(): void;
    input: AudioNode;
    output: AudioNode;
    setParameter(name: string, value: number): void;
    state?(): string;
    tick?(): void;
}

interface RackState {
    activeKinds: RackKind[];
    durationSeconds: number;
    fileName: null | string;
    playing: boolean;
}

interface RosterLink {
    href: string;
    label: string;
}

interface RosterMember {
    bio: string;
    featured: boolean;
    genres: string[];
    id: string;
    joined: string;
    links: RosterLink[];
    location: string;
    name: string;
    portrait: string;
    roles: MemberRole[];
    tracks: RosterTrack[];
}

interface RosterTrack {
    durationSeconds: number;
    path: string;
    title: string;
}

interface Session {
    admin: boolean;
    artistName: string;
    avatar: string;
    bio: string;
    city: string;
    createdAt: number;
    email: string;
    genres: string[];
    id: string;
    links: SessionLinks;
    onboarded: boolean;
    passwordless: boolean;
    prods: number;
    role: string;
    state: string;
    track: string;
}

interface SessionDraft {
    email: string;
    password: string;
}

interface SessionLinks {
    instagram: string;
    soundcloud: string;
    spotify: string;
    youtube: string;
}

interface ShippingAddress {
    city: string;
    familyName: string;
    givenName: string;
    line1: string;
    line2: string;
    state: string;
    zip: string;
}

interface SignedTrack {
    expiresAt: number;
    url: string;
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

interface TileColor {
    background: string;
    text: string;
}

interface TrackLink {
    host: string;
    href: string;
    id: string;
}

interface TrackState {
    playing: boolean;
    trackId: string;
}

interface UploadEntry {
    durationSeconds?: number;
    error?: string;
    file: File;
    peaks?: Float32Array;
    status: 'failed' | 'queued' | 'reading' | 'ready' | 'rejected';
    totalBytes: number;
}

interface UploadOptions {
    onProgress?: (loadedBytes: number, totalBytes: number) => void;
    signal: AbortSignal;
}

interface Window {
    __apaMotion?: MotionBridge;
}

interface WindowEventMap {
    'apa:float-window': CustomEvent<{ panel: HTMLElement }>;
    'apa:theme-changed': Event;
    'apa:toast': CustomEvent<{ message: string; tone: ToastTone }>;
    'apa:toast-retract': CustomEvent<{ message: string; tone: ToastTone }>;
    'apa:track-play': CustomEvent<{ track: PlayerTrack }>;
    'apa:track-state': CustomEvent<TrackState>;
}
