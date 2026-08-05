import { buildBlock } from '@lib/audio/rack/blocks';
import { createStore } from '@lib/state';
import { decodeRackFile } from '@lib/audio/rack/loader';
import { ensureRackAudio, suspendRackAudio } from '@lib/audio/rack/context';
import { getPlayerState, onPlayerChange, togglePlayback } from '@lib/audio';

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

const RACK_KEY = 'apa.rack';

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

const RACK_TOPIC = 'apa:rack-changed';
const REBUILD_DELAY_MS = 20;
const SETTLE_DELAY_MS = 60;

const blocks = new Map<RackKind, RackBlock>();
const params = new Map<string, number>();

const store = createStore<RackState>({
    fallback: { activeKinds: [], durationSeconds: 0, fileName: null, playing: false },
    key: RACK_KEY,
    scope: 'memory',
    topic: RACK_TOPIC,
});

let buffer: AudioBuffer | undefined;
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

    if (source) fadeInput(1);
}

function connectChain() {
    const { context, master } = ensureRackAudio();
    const chain = [...store.get().activeKinds].sort((left, right) => RACK_ORDER.indexOf(left) - RACK_ORDER.indexOf(right));
    const head = ensureInput(context);

    head.disconnect();
    blocks.forEach(block => block.output.disconnect());

    let tail: AudioNode = head;

    for (const kind of chain) {
        const block = ensureBlock(kind, context);

        tail.connect(block.input);
        tail = block.output;
    }

    tail.connect(master);
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

function ensureInput(context: AudioContext) {
    if (!input) input = context.createGain();

    return input;
}

function fadeInput(target: number) {
    if (!input) return;

    const now = input.context.currentTime;

    input.gain.cancelScheduledValues(now);
    input.gain.setValueAtTime(input.gain.value, now);
    input.gain.linearRampToValueAtTime(target, now + CROSSFADE_SECONDS);
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
    stopSource(CROSSFADE_SECONDS);
    clearTimeout(rebuild);
    clearTimeout(settle);
    rebuild = undefined;
    settle = setTimeout(suspendRackAudio, SETTLE_DELAY_MS);
    store.set({ ...state, playing: false });
}

function playRack(): void {
    const state = store.get();

    if (!buffer || state.playing) return;

    if (getPlayerState().playing) togglePlayback();

    clearTimeout(settle);
    settle = undefined;
    startSource(pausedPosition);
    store.set({ ...state, playing: true });
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
    if (!source) {
        pruneBlocks();

        return;
    }

    clearTimeout(rebuild);
    fadeInput(0);
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
    params.set(`${kind}:${name}`, value);
    blocks.get(kind)?.setParam(name, value);
}

function startSource(offset: number) {
    if (!buffer) return;

    const { context } = ensureRackAudio();
    const head = ensureInput(context);

    stopSource(0);
    clearTimeout(rebuild);
    rebuild = undefined;
    connectChain();

    const next = context.createBufferSource();
    const now = context.currentTime;

    next.buffer = buffer;
    next.loop = true;
    next.connect(head);
    next.start(0, offset % buffer.duration);
    source = next;
    startedAt = now - offset;
    head.gain.cancelScheduledValues(now);
    head.gain.setValueAtTime(0, now);
    head.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
}

function stopSource(seconds: number) {
    cancelAnimationFrame(frame);
    frame = 0;

    const node = source;

    source = undefined;

    if (!node) return;

    if (seconds > 0) fadeInput(0);

    try {
        node.stop(node.context.currentTime + seconds);
        node.addEventListener('ended', () => node.disconnect(), { once: true });
    } catch {
        node.disconnect();
    }
}

function tick() {
    for (const kind of store.get().activeKinds) blocks.get(kind)?.tick?.();

    frame = requestAnimationFrame(tick);
}

function toggleRack(): void {
    if (store.get().playing) {
        pauseRack();

        return;
    }

    playRack();
}

onPlayerChange(handlePlayerChange);

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
