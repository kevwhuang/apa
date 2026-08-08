import { STORAGE } from '@lib/shared/constants';
import { buildBlock } from '@lib/rack/blocks';
import { createStore } from '@lib/shared/state';
import { decodeRackFile } from '@lib/rack/loader';
import { ensureRackAudio, hasChainFeed, setRackChainBuilder, suspendRackAudio } from '@lib/rack/context';
import { getPlayerState, onPlayerChange, togglePlayback } from '@lib/audio/player';

const CROSSFADE_SECONDS = 0.015;

const MODULE_NAMES: Record<RackKind, string> = {
    chorus: 'Weave',
    compressor: 'Clamp',
    delay: 'Relay',
    distortion: 'Scorch',
    eq: 'Ledger',
    filter: 'Sieve',
    gate: 'Latch',
    highpass: 'Sill',
    limiter: 'Ceiling',
    meter: 'Needle',
    pan: 'Bearing',
    reverb: 'Chamber',
    saturator: 'Grit',
    tremolo: 'Pulse',
    trim: 'Tare',
    tuner: 'Pitchfork',
};

const RACK_ORDER: RackKind[] = [
    'trim',
    'filter',
    'highpass',
    'eq',
    'gate',
    'compressor',
    'distortion',
    'saturator',
    'chorus',
    'tremolo',
    'delay',
    'reverb',
    'pan',
    'limiter',
    'meter',
    'tuner',
];

const REBUILD_DELAY_MS = 20;
const SETTLE_DELAY_MS = 60;

const blocks = new Map<RackKind, RackBlock>();
const params = new Map<string, number>();

const store = createStore<RackState>({
    fallback: { activeKinds: [], durationSeconds: 0, fileName: null, playing: false },
    key: STORAGE.rack.key,
    scope: STORAGE.rack.scope,
    topic: STORAGE.rack.topic,
});

let buffer: AudioBuffer | undefined;
let bus: GainNode | undefined;
let frame = 0;
let input: GainNode | undefined;
let pausedPosition = 0;
let rebuild: Timer | undefined;
let settle: Timer | undefined;
let source: AudioBufferSourceNode | undefined;
let startedAt = 0;

function applyRebuild() {
    rebuild = undefined;
    connectChain();
    pruneBlocks();
}

function attachChain() {
    connectChain();
    startTicking();
}

function connectChain() {
    const { context, input: head, master } = ensureRackAudio();
    const chain = [...store.get().activeKinds].sort((left, right) => RACK_ORDER.indexOf(left) - RACK_ORDER.indexOf(right));

    input = head;

    blocks.forEach(block => block.output.disconnect());
    head.disconnect();

    let tail: AudioNode = head;

    for (const kind of chain) {
        const block = ensureBlock(kind, context);

        tail.connect(block.input);
        tail = block.output;
    }

    tail.connect(master);
    fade(head, 1);
}

function ensureBlock(kind: RackKind, context: AudioContext) {
    const known = blocks.get(kind);

    if (known) return known;

    const block = buildBlock(kind, context);

    params.forEach((value, key) => {
        const [target, name] = key.split(':');

        if (target === kind) block.setParam(name, value);
    });

    blocks.set(kind, block);

    return block;
}

function ensureBus(audio: RackAudio) {
    if (!bus) {
        bus = audio.context.createGain();
        bus.connect(audio.input);
    }

    return bus;
}

function fade(node: GainNode | undefined, target: number) {
    if (!node) return;

    const now = node.context.currentTime;

    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(target, now + CROSSFADE_SECONDS);
}

function getRackAnalyser(kind: RackKind): AnalyserNode | undefined {
    return blocks.get(kind)?.analyser;
}

function getRackPosition(): number {
    const { durationSeconds, playing } = store.get();

    if (!playing || !input || durationSeconds === 0) return pausedPosition;

    return (input.context.currentTime - startedAt) % durationSeconds;
}

function getRackReadout(kind: RackKind): string | undefined {
    return blocks.get(kind)?.state?.();
}

function getRackState(): RackState {
    return store.get();
}

function handlePlayerChange(state: PlayerState) {
    if (state.playing) pauseRack();
}

function hasFeed() {
    return Boolean(source) || hasChainFeed();
}

function isModuleActive(kind: RackKind): boolean {
    return store.get().activeKinds.includes(kind);
}

async function loadRackFile(file: File): Promise<RackLoadResult> {
    const result = await decodeRackFile(file);

    if (!result.ok) return result;

    buffer = result.buffer;
    pausedPosition = 0;

    const state = store.set({ ...store.get(), durationSeconds: result.buffer.duration, fileName: file.name });

    if (state.playing) startSource(0);

    return result;
}

function onRackChange(callback: (state: RackState) => void): () => void {
    return store.onChange(callback);
}

function pauseRack(): void {
    const state = store.get();

    if (!state.playing) return;

    pausedPosition = getRackPosition();
    clearTimeout(rebuild);
    clearTimeout(settle);
    stopSource(CROSSFADE_SECONDS);
    store.set({ ...state, playing: false });
    rebuild = undefined;
    settle = setTimeout(suspendRackAudio, SETTLE_DELAY_MS);
}

function playRack(): void {
    const state = store.get();

    if (!buffer || state.playing) return;

    if (getPlayerState().playing) togglePlayback();

    clearTimeout(settle);
    startSource(pausedPosition);
    store.set({ ...state, playing: true });
    settle = undefined;
}

function pruneBlocks() {
    const { activeKinds } = store.get();

    for (const [kind, block] of blocks) {
        if (activeKinds.includes(kind)) continue;

        block.dispose();
        blocks.delete(kind);
    }
}

function scheduleRebuild() {
    if (!hasFeed()) {
        pruneBlocks();

        return;
    }

    clearTimeout(rebuild);
    fade(input, 0);
    rebuild = setTimeout(applyRebuild, REBUILD_DELAY_MS);
}

function seekRack(seconds: number): void {
    const state = store.get();

    if (!buffer) return;

    pausedPosition = Math.min(Math.max(0, seconds), state.durationSeconds);

    if (state.playing) {
        startSource(pausedPosition);

        return;
    }

    store.set({ ...state });
}

function setModuleActive(kind: RackKind, active: boolean): void {
    const state = store.get();

    if (state.activeKinds.includes(kind) === active) return;

    const activeKinds = active ? [...state.activeKinds, kind] : state.activeKinds.filter(entry => entry !== kind);

    store.set({ ...state, activeKinds });
    scheduleRebuild();
}

function setRackParam(kind: RackKind, name: string, value: number): void {
    blocks.get(kind)?.setParam(name, value);
    params.set(`${kind}:${name}`, value);
}

function startSource(offset: number) {
    if (!buffer) return;

    const audio = ensureRackAudio();

    const feed = ensureBus(audio);

    clearTimeout(rebuild);
    connectChain();
    stopSource(0);
    rebuild = undefined;

    const next = audio.context.createBufferSource();
    const now = audio.context.currentTime;

    next.buffer = buffer;
    next.loop = true;
    feed.gain.cancelScheduledValues(now);
    feed.gain.setValueAtTime(0, now);
    feed.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    next.connect(feed);
    next.start(0, offset % buffer.duration);
    source = next;
    startedAt = now - offset;
    startTicking();
}

function startTicking() {
    if (frame !== 0 || !hasFeed()) return;

    frame = requestAnimationFrame(tick);
}

function stopSource(seconds: number) {
    const node = source;

    source = undefined;

    if (!node) return;

    if (seconds > 0) fade(bus, 0);

    try {
        node.stop(node.context.currentTime + seconds);
        node.addEventListener('ended', () => node.disconnect(), { once: true });
    } catch {
        node.disconnect();
    }
}

function tick() {
    frame = 0;

    for (const kind of store.get().activeKinds) blocks.get(kind)?.tick?.();

    startTicking();
}

function toggleRack(): void {
    if (store.get().playing) {
        pauseRack();

        return;
    }

    playRack();
}

onPlayerChange(handlePlayerChange);
setRackChainBuilder(attachChain);

export {
    MODULE_NAMES,
    RACK_ORDER,
    getRackAnalyser,
    getRackPosition,
    getRackReadout,
    getRackState,
    isModuleActive,
    loadRackFile,
    onRackChange,
    pauseRack,
    playRack,
    seekRack,
    setModuleActive,
    setRackParam,
    toggleRack,
};
