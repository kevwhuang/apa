import { buildBlock } from '@lib/audio/sandbox/blocks';
import { createStore } from '@lib/state';
import { ensureSandboxAudio, suspendSandboxAudio } from '@lib/audio/sandbox/context';
import { getPlayerState, onPlayerChange, togglePlayback } from '@lib/audio';
import { loadSandboxFile } from '@lib/audio/sandbox/loader';

const CROSSFADE_SECONDS = 0.015;

export const MODULE_NAMES: Record<SandboxKind, string> = {
    chorus: 'Swell',
    compressor: 'Clamp',
    delay: 'Offset',
    eq: 'Ledger',
    filter: 'Sieve',
    gate: 'Latch',
    highpass: 'Ridge',
    limiter: 'Ceiling',
    meter: 'Needle',
    pan: 'Bearing',
    reverb: 'Chamber',
    saturator: 'Grit',
    tremolo: 'Flutter',
    trim: 'Tare',
    tuner: 'Pitchfork',
};

const RACK_KEY = 'apa.rack';

const RACK_ORDER: SandboxKind[] = [
    'trim',
    'highpass',
    'filter',
    'eq',
    'gate',
    'compressor',
    'saturator',
    'chorus',
    'tremolo',
    'pan',
    'delay',
    'reverb',
    'limiter',
    'meter',
    'tuner',
];

const RACK_TOPIC = 'apa:rack-changed';

const REBUILD_DELAY_MS = 20;

const SETTLE_DELAY_MS = 60;

const blocks = new Map<SandboxKind, SandboxBlock>();

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
let rebuild: Timer | undefined;
let settle: Timer | undefined;
let source: AudioBufferSourceNode | undefined;

function applyRebuild() {
    rebuild = undefined;

    connectChain();
    pruneBlocks();

    if (source) fadeInput(1);
}

function connectChain() {
    const { context, master } = ensureSandboxAudio();
    const head = ensureInput(context);

    head.disconnect();
    blocks.forEach(block => block.output.disconnect());

    let tail: AudioNode = head;

    for (const kind of store.get().activeKinds) {
        const block = ensureBlock(kind, context);

        tail.connect(block.input);
        tail = block.output;
    }

    tail.connect(master);
}

function ensureBlock(kind: SandboxKind, context: AudioContext) {
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

export function getRackAnalyser(kind: SandboxKind): AnalyserNode | undefined {
    return blocks.get(kind)?.analyser;
}

export function getRackReadout(kind: SandboxKind): string | undefined {
    return blocks.get(kind)?.state?.();
}

export function getRackState(): RackState {
    return store.get();
}

function handlePlayerChange(state: PlayerState) {
    if (state.playing) pauseRack();
}

export function isModuleActive(kind: SandboxKind): boolean {
    return store.get().activeKinds.includes(kind);
}

export async function loadRackFile(file: File): Promise<SandboxLoadResult> {
    const result = await loadSandboxFile(file);

    if (!result.ok) return result;

    buffer = result.buffer;

    const state = store.set({ ...store.get(), durationSeconds: result.buffer.duration, fileName: file.name });

    if (state.playing) startSource();

    return result;
}

export function onRackChange(callback: (state: RackState) => void): () => void {
    return store.onChange(callback);
}

export function pauseRack(): void {
    const state = store.get();

    if (!state.playing) return;

    stopSource(CROSSFADE_SECONDS);
    clearTimeout(rebuild);
    clearTimeout(settle);
    rebuild = undefined;
    settle = setTimeout(suspendSandboxAudio, SETTLE_DELAY_MS);
    store.set({ ...state, playing: false });
}

export function playRack(): void {
    const state = store.get();

    if (!buffer || state.playing) return;

    if (getPlayerState().playing) togglePlayback();

    clearTimeout(settle);
    settle = undefined;
    startSource();
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

export function setModuleActive(kind: SandboxKind, active: boolean): void {
    const state = store.get();

    if (state.activeKinds.includes(kind) === active) return;

    const activeKinds = RACK_ORDER.filter(entry => (entry === kind ? active : state.activeKinds.includes(entry)));

    store.set({ ...state, activeKinds });
    scheduleRebuild();
}

export function setRackParam(kind: SandboxKind, name: string, value: number): void {
    params.set(`${kind}:${name}`, value);
    blocks.get(kind)?.setParam(name, value);
}

function startSource() {
    if (!buffer) return;

    const { context } = ensureSandboxAudio();
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
    next.start();
    source = next;
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

export function toggleRack(): void {
    if (store.get().playing) {
        pauseRack();

        return;
    }

    playRack();
}

onPlayerChange(handlePlayerChange);
