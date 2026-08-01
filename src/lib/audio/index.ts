import { STORAGE, TRACK_STATE_TOPIC } from '@lib/constants';
import { createStore } from '@lib/state';

const ATTACK_DIVISOR = 8;

const BASS_LEVEL = 0.5;

const BASS_RELEASE = 0.9;

const BASS_STEPS = [0, 10];

const BEATS_PER_BAR = 4;

const HASH_MULTIPLIER = 31;

const HAT_CUTOFF_HERTZ = 7_000;

const HAT_LEVEL = 0.06;

const HAT_RELEASE = 0.055;

const LEAD_LEVEL = 0.16;

const LEAD_RELEASE = 0.34;

const LEAD_THRESHOLD = 0.55;

const LOOKAHEAD_MS = 25;

const MASTER_LEVEL = 0.55;

const MIDI_A4 = 69;

const MINIMUM_GAIN = 0.0001;

const MUTE_RAMP = 0.01;

const NOISE_SECONDS = 1;

const OCTAVE_THRESHOLD = 0.85;

const PENTATONIC = [0, 3, 5, 7, 10];

const RANDOM_ADDEND = 12_345;

const RANDOM_MODULUS = 2_147_483_648;

const RANDOM_MULTIPLIER = 1_103_515_245;

const ROOT_MIDI = 36;

const SCALE_SALT = 7;

const SCHEDULE_AHEAD = 0.15;

const SECONDS_PER_MINUTE = 60;

const SEMITONES_PER_OCTAVE = 12;

const START_PADDING = 0.06;

const STEPS_PER_BEAT = 4;

const TEMPO_BASE = 84;

const TEMPO_SPREAD = 5;

const TEMPO_STEP = 8;

const TUNING_HERTZ = 440;

const store = createStore<PlayerState>({
    fallback: { open: false, playing: false, position: 0 },
    key: STORAGE.player.key,
    scope: STORAGE.player.scope,
    topic: STORAGE.player.topic,
});

let context: AudioContext | undefined;
let current: PlayerTrack | undefined;
let master: GainNode | undefined;
let muted = false;
let noise: AudioBuffer | undefined;
let scheduler: Timer | undefined;
let startedAt = 0;
let stepCursor = 0;
let stepTime = 0;
let voices: AudioScheduledSourceNode[] = [];

export function announceTrackState(): void {
    if (typeof window === 'undefined') return;

    const state = store.get();
    const detail: TrackState = { playing: state.playing, trackId: current?.id ?? '' };

    window.dispatchEvent(new CustomEvent(TRACK_STATE_TOPIC, { detail }));
}

function beatSeconds(track: PlayerTrack): number {
    return SECONDS_PER_MINUTE / tempo(track);
}

export function closePlayer(): void {
    store.set({ ...store.get(), open: false });
}

function ensureContext(): AudioContext | undefined {
    if (context) return context;
    if (typeof AudioContext === 'undefined') return undefined;

    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate);

    const samples = noise.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;

    return context;
}

export function getPlayerState(): PlayerState {
    return store.get();
}

export function getPosition(): number {
    const state = store.get();
    const track = current;

    if (!track) return 0;
    if (!state.playing || !context) return Math.min(state.position, track.durationSeconds);

    return Math.min(context.currentTime - startedAt, track.durationSeconds);
}

export function getTrack(): PlayerTrack | undefined {
    return current;
}

function hash(value: string): number {
    let total = 0;

    for (let index = 0; index < value.length; index += 1) {
        total = (total * HASH_MULTIPLIER + value.charCodeAt(index)) % RANDOM_MODULUS;
    }

    return total;
}

export function isMuted(): boolean {
    return muted;
}

function noteHertz(midi: number): number {
    return TUNING_HERTZ * 2 ** ((midi - MIDI_A4) / SEMITONES_PER_OCTAVE);
}

export function onPlayerChange(callback: (state: PlayerState) => void): () => void {
    return store.onChange(callback);
}

export function openPlayer(): void {
    store.set({ ...store.get(), open: true });
}

function pausePlayback(): void {
    const position = getPosition();

    stopVoices();
    store.set({ ...store.get(), playing: false, position });
    announceTrackState();
}

export function playTrack(track: PlayerTrack): void {
    stopVoices();
    current = track;
    store.set({ ...store.get(), open: true, playing: false, position: 0 });
    resumePlayback();
}

function pluck(track: PlayerTrack, at: number, midi: number, level: number, release: number, kind: OscillatorType): void {
    if (!context || !master) return;

    const gain = context.createGain();
    const oscillator = context.createOscillator();

    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(noteHertz(midi), at);
    gain.gain.setValueAtTime(MINIMUM_GAIN, at);
    gain.gain.exponentialRampToValueAtTime(level, at + stepSeconds(track) / ATTACK_DIVISOR);
    gain.gain.exponentialRampToValueAtTime(MINIMUM_GAIN, at + release);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + release);
    registerVoice(oscillator);
}

function random(seed: number): number {
    return ((seed * RANDOM_MULTIPLIER + RANDOM_ADDEND) % RANDOM_MODULUS) / RANDOM_MODULUS;
}

function registerVoice(voice: AudioScheduledSourceNode): void {
    voices.push(voice);
    voice.addEventListener('ended', () => {
        voices = voices.filter(entry => entry !== voice);
    }, { once: true });
}

function resumePlayback(): void {
    const state = store.get();
    const track = current;
    const audio = ensureContext();

    if (!track || !audio) return;

    void audio.resume();
    stopVoices();

    const from = state.position >= track.durationSeconds ? 0 : state.position;

    stepCursor = Math.floor(from / stepSeconds(track));
    stepTime = audio.currentTime + START_PADDING;
    startedAt = stepTime - stepCursor * stepSeconds(track);
    scheduler = setInterval(tick, LOOKAHEAD_MS);
    store.set({ ...state, open: true, playing: true, position: from });
    announceTrackState();
}

function scheduleStep(track: PlayerTrack, step: number, at: number): void {
    const seed = hash(track.id);
    const root = ROOT_MIDI + (seed % SEMITONES_PER_OCTAVE);
    const beat = step % (STEPS_PER_BEAT * BEATS_PER_BAR);
    const roll = random(seed + step);

    if (BASS_STEPS.includes(beat)) pluck(track, at, root, BASS_LEVEL, BASS_RELEASE, 'triangle');
    if (step % 2 === 1) whisper(at);
    if (roll < LEAD_THRESHOLD) return;

    const degree = PENTATONIC[Math.floor(random(seed + step * SCALE_SALT) * PENTATONIC.length)];
    const octave = roll > OCTAVE_THRESHOLD ? 2 : 1;

    pluck(track, at, root + degree + octave * SEMITONES_PER_OCTAVE, LEAD_LEVEL, LEAD_RELEASE, 'sawtooth');
}

export function seekTo(seconds: number): void {
    const state = store.get();
    const track = current;

    if (!track) return;

    const position = Math.min(Math.max(0, seconds), track.durationSeconds);

    store.set({ ...state, position });

    if (state.playing) resumePlayback();
}

export function setMuted(next: boolean): void {
    muted = next;

    if (context && master) master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, context.currentTime, MUTE_RAMP);
}

function stepSeconds(track: PlayerTrack): number {
    return beatSeconds(track) / STEPS_PER_BEAT;
}

function stopPlayback(): void {
    stopVoices();
    store.set({ ...store.get(), playing: false, position: 0 });
    announceTrackState();
}

function stopVoices(): void {
    clearInterval(scheduler);
    scheduler = undefined;
    voices.forEach((voice) => {
        try {
            voice.stop();
        } catch {
            voice.disconnect();
        }
    });
    voices = [];
}

function tempo(track: PlayerTrack): number {
    return TEMPO_BASE + (hash(track.id) % TEMPO_SPREAD) * TEMPO_STEP;
}

function tick(): void {
    const track = current;

    if (!context || !track) return;

    if (context.currentTime - startedAt >= track.durationSeconds) {
        stopPlayback();

        return;
    }

    while (stepTime < context.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(track, stepCursor, stepTime);
        stepTime += stepSeconds(track);
        stepCursor += 1;
    }
}

export function togglePlayback(): void {
    if (store.get().playing) {
        pausePlayback();

        return;
    }

    resumePlayback();
}

function whisper(at: number): void {
    if (!context || !master || !noise) return;

    const gain = context.createGain();
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = HAT_CUTOFF_HERTZ;
    source.buffer = noise;
    gain.gain.setValueAtTime(HAT_LEVEL, at);
    gain.gain.exponentialRampToValueAtTime(MINIMUM_GAIN, at + HAT_RELEASE);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + HAT_RELEASE);
    registerVoice(source);
}
