interface RackStage {
    dispose(): void;
    input: GainNode;
    output: GainNode;
    set(enabled: boolean): void;
}

export const ANALYSER_FFT = 2_048;

const CENTS_PER_OCTAVE = 1_200;

const CHORUS_BASE_A = 0.016;

const CHORUS_BASE_B = 0.023;

export const CHORUS_DEPTH_DEFAULT = 0.5;

const CHORUS_DEPTH_MAX = 0.006;

export const CHORUS_RATE_DEFAULT = 1.2;

const CHORUS_VOICE_LEVEL = 0.4;

const COMPRESSOR_ATTACK = 0.01;

const COMPRESSOR_KNEE = 12;

export const COMPRESSOR_RATIO_DEFAULT = 4;

const COMPRESSOR_RELEASE = 0.18;

export const COMPRESSOR_THRESHOLD_DEFAULT = -28;

const CURVE_LENGTH = 1_024;

export const DELAY_FEEDBACK_DEFAULT = 0.45;

const DELAY_MAX_SECONDS = 2;

export const DELAY_TIME_DEFAULT = 0.35;

const DELAY_WET_LEVEL = 0.7;

const EQ_HIGH_HERTZ = 4_000;

const EQ_LOW_HERTZ = 200;

const EQ_MID_HERTZ = 1_000;

const FEEDBACK_CAP = 0.85;

const FILTER_CUTOFF_DEFAULT = 1_150;

export const FILTER_RESONANCE_DEFAULT = 4;

const GATE_ATTACK = 0.004;

const GATE_FLOOR = 0.000_001;

const GATE_RELEASE = 0.08;

export const GATE_THRESHOLD_DEFAULT = -45;

const IMPULSE_SHAPE = 3;

const LIMITER_ATTACK = 0.001;

const LIMITER_RATIO = 20;

const LIMITER_RELEASE = 0.1;

export const LIMITER_THRESHOLD_DEFAULT = -12;

const MIDI_A4 = 69;

const MIDI_OCTAVE_OFFSET = 1;

const MIN_RMS = 0.008;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PITCH_MAX_HERTZ = 1_000;

const PITCH_MIN_CORRELATION = 0.5;

const PITCH_MIN_HERTZ = 60;

const RACK_DELAY_FEEDBACK = 0.35;

const RACK_DELAY_TIME = 0.28;

const RACK_DRIVE = 4;

const RACK_FILTER_HERTZ = 1_800;

const RACK_RESONANCE = 2;

export const REVERB_DECAY_DEFAULT = 2.4;

export const REVERB_WET_DEFAULT = 0.4;

export const SATURATOR_DRIVE_DEFAULT = 3;

const SEMITONES_PER_OCTAVE = 12;

const SMOOTHING = 0.02;

const TAIL_SECONDS = 0.05;

const TICK_INTERVAL = 4;

const TUNING_HERTZ = 440;

export function buildBlock(kind: SandboxKind, context: AudioContext): SandboxBlock {
    switch (kind) {
        case 'chorus': return buildChorus(context);
        case 'compressor': return buildCompressor(context);
        case 'delay': return buildDelay(context);
        case 'eq': return buildEq(context);
        case 'filter': return buildFilter(context);
        case 'gate': return buildGate(context);
        case 'limiter': return buildLimiter(context);
        case 'meter': return buildMeter(context);
        case 'rack': return buildRack(context);
        case 'reverb': return buildReverb(context);
        case 'saturator': return buildSaturator(context);
        case 'tuner': return buildTuner(context);
    }
}

function buildChorus(context: AudioContext) {
    const delayA = context.createDelay(DELAY_MAX_SECONDS);
    const delayB = context.createDelay(DELAY_MAX_SECONDS);
    const depthA = context.createGain();
    const depthB = context.createGain();
    const dry = context.createGain();
    const input = context.createGain();
    const lfo = context.createOscillator();
    const output = context.createGain();
    const wetA = context.createGain();
    const wetB = context.createGain();

    delayA.delayTime.value = CHORUS_BASE_A;
    delayB.delayTime.value = CHORUS_BASE_B;
    depthA.gain.value = CHORUS_DEPTH_MAX * CHORUS_DEPTH_DEFAULT;
    depthB.gain.value = -CHORUS_DEPTH_MAX * CHORUS_DEPTH_DEFAULT;
    dry.gain.value = 1 - CHORUS_VOICE_LEVEL;
    lfo.frequency.value = CHORUS_RATE_DEFAULT;
    wetA.gain.value = CHORUS_VOICE_LEVEL;
    wetB.gain.value = CHORUS_VOICE_LEVEL;
    input.connect(dry).connect(output);
    input.connect(delayA).connect(wetA).connect(output);
    input.connect(delayB).connect(wetB).connect(output);
    lfo.connect(depthA).connect(delayA.delayTime);
    lfo.connect(depthB).connect(delayB.delayTime);
    lfo.start();

    return {
        dispose(): void {
            lfo.stop();
            [delayA, delayB, depthA, depthB, dry, input, lfo, output, wetA, wetB].forEach(node => node.disconnect());
        },
        input,
        output,
        setParam(name: string, value: number): void {
            if (name === 'rate') smooth(context, lfo.frequency, value);

            if (name === 'depth') {
                smooth(context, depthA.gain, value * CHORUS_DEPTH_MAX);
                smooth(context, depthB.gain, -value * CHORUS_DEPTH_MAX);
            }
        },
    };
}

function buildCompressor(context: AudioContext) {
    const node = context.createDynamicsCompressor();

    node.attack.value = COMPRESSOR_ATTACK;
    node.knee.value = COMPRESSOR_KNEE;
    node.ratio.value = COMPRESSOR_RATIO_DEFAULT;
    node.release.value = COMPRESSOR_RELEASE;
    node.threshold.value = COMPRESSOR_THRESHOLD_DEFAULT;

    return {
        dispose: () => node.disconnect(),
        input: node,
        output: node,
        setParam(name: string, value: number): void {
            if (name === 'ratio') smooth(context, node.ratio, value);
            if (name === 'threshold') smooth(context, node.threshold, value);
        },
        state: () => `GR ${node.reduction.toFixed(1)} dB`,
    };
}

function buildDelay(context: AudioContext) {
    const delay = context.createDelay(DELAY_MAX_SECONDS);
    const dry = context.createGain();
    const feedback = context.createGain();
    const input = context.createGain();
    const output = context.createGain();
    const wet = context.createGain();

    let flushed = false;
    let level = DELAY_FEEDBACK_DEFAULT;

    delay.delayTime.value = DELAY_TIME_DEFAULT;
    feedback.gain.value = level;
    wet.gain.value = DELAY_WET_LEVEL;
    input.connect(dry).connect(output);
    input.connect(delay).connect(wet).connect(output);
    delay.connect(feedback).connect(delay);

    return {
        dispose: () => [delay, dry, feedback, input, output, wet].forEach(node => node.disconnect()),
        flushTails(): void {
            flushed = true;
            fade(context, feedback.gain, 0, TAIL_SECONDS);
        },
        input,
        output,
        restoreTails(): void {
            flushed = false;
            smooth(context, feedback.gain, level);
        },
        setParam(name: string, value: number): void {
            if (name === 'time') smooth(context, delay.delayTime, value);

            if (name === 'feedback') {
                level = Math.min(value, FEEDBACK_CAP);

                if (!flushed) smooth(context, feedback.gain, level);
            }
        },
    };
}

function buildEq(context: AudioContext) {
    const high = context.createBiquadFilter();
    const low = context.createBiquadFilter();
    const mid = context.createBiquadFilter();

    high.type = 'highshelf';
    high.frequency.value = EQ_HIGH_HERTZ;
    low.type = 'lowshelf';
    low.frequency.value = EQ_LOW_HERTZ;
    mid.type = 'peaking';
    mid.frequency.value = EQ_MID_HERTZ;
    mid.gain.value = 0;
    low.connect(mid).connect(high);

    return {
        dispose: () => [high, low, mid].forEach(node => node.disconnect()),
        input: low,
        output: high,
        setParam(name: string, value: number): void {
            if (name === 'low') smooth(context, low.gain, value);
            if (name === 'high') smooth(context, high.gain, value);
        },
    };
}

function buildFilter(context: AudioContext) {
    const node = context.createBiquadFilter();

    node.type = 'lowpass';
    node.frequency.value = FILTER_CUTOFF_DEFAULT;
    node.Q.value = FILTER_RESONANCE_DEFAULT;

    return {
        dispose: () => node.disconnect(),
        input: node,
        output: node,
        setParam(name: string, value: number): void {
            if (name === 'cutoff') smooth(context, node.frequency, value);
            if (name === 'resonance') smooth(context, node.Q, value);
        },
    };
}

function buildGate(context: AudioContext) {
    const analyser = context.createAnalyser();
    const gate = context.createGain();
    const input = context.createGain();

    analyser.fftSize = ANALYSER_FFT;

    const data = new Float32Array(analyser.fftSize);

    let open = false;
    let threshold = GATE_THRESHOLD_DEFAULT;

    gate.gain.value = 0;
    input.connect(analyser);
    input.connect(gate);

    return {
        dispose: () => [analyser, gate, input].forEach(node => node.disconnect()),
        input,
        output: gate,
        setParam(name: string, value: number): void {
            if (name === 'threshold') threshold = value;
        },
        state: () => (open ? 'Gate open' : 'Gate closed'),
        tick(): void {
            analyser.getFloatTimeDomainData(data);

            const decibels = 20 * Math.log10(Math.max(rootMeanSquare(data), GATE_FLOOR));
            const next = decibels > threshold;

            if (next === open) return;

            open = next;
            gate.gain.setTargetAtTime(next ? 1 : 0, context.currentTime, next ? GATE_ATTACK : GATE_RELEASE);
        },
    };
}

function buildLimiter(context: AudioContext) {
    const node = context.createDynamicsCompressor();

    node.attack.value = LIMITER_ATTACK;
    node.knee.value = 0;
    node.ratio.value = LIMITER_RATIO;
    node.release.value = LIMITER_RELEASE;
    node.threshold.value = LIMITER_THRESHOLD_DEFAULT;

    return {
        dispose: () => node.disconnect(),
        input: node,
        output: node,
        setParam(name: string, value: number): void {
            if (name === 'threshold') smooth(context, node.threshold, value);
        },
        state: () => `Ceiling ${node.threshold.value.toFixed(1)} dB \u00b7 GR ${node.reduction.toFixed(1)} dB`,
    };
}

function buildMeter(context: AudioContext) {
    const analyser = context.createAnalyser();

    analyser.fftSize = ANALYSER_FFT;

    return {
        analyser,
        dispose: () => analyser.disconnect(),
        input: analyser,
        output: analyser,
        setParam: () => undefined,
    };
}

function buildRack(context: AudioContext) {
    const delay = buildDelay(context);
    const filter = buildFilter(context);
    const saturator = buildSaturator(context);

    delay.setParam('feedback', RACK_DELAY_FEEDBACK);
    delay.setParam('time', RACK_DELAY_TIME);
    filter.setParam('cutoff', RACK_FILTER_HERTZ);
    filter.setParam('resonance', RACK_RESONANCE);
    saturator.setParam('drive', RACK_DRIVE);

    const stageDelay = wrapStage(context, delay);
    const stageFilter = wrapStage(context, filter);
    const stageSaturator = wrapStage(context, saturator);
    const stages: Record<string, RackStage> = { delay: stageDelay, filter: stageFilter, saturator: stageSaturator };

    stageSaturator.output.connect(stageFilter.input);
    stageFilter.output.connect(stageDelay.input);

    return {
        dispose(): void {
            [delay, filter, saturator].forEach(block => block.dispose());
            [stageDelay, stageFilter, stageSaturator].forEach(stage => stage.dispose());
        },
        flushTails: () => delay.flushTails?.(),
        input: stageSaturator.input,
        output: stageDelay.output,
        restoreTails: () => delay.restoreTails?.(),
        setParam: () => undefined,
        setStage(name: string, enabled: boolean): void {
            stages[name]?.set(enabled);
        },
    };
}

function buildReverb(context: AudioContext) {
    const convolver = context.createConvolver();
    const dry = context.createGain();
    const input = context.createGain();
    const output = context.createGain();
    const wet = context.createGain();

    let built = REVERB_DECAY_DEFAULT;
    let pending = REVERB_DECAY_DEFAULT;
    let rebuild = 0;

    convolver.buffer = impulse(context, built);
    dry.gain.value = 1 - REVERB_WET_DEFAULT;
    wet.gain.value = REVERB_WET_DEFAULT;
    input.connect(dry).connect(output);
    input.connect(convolver).connect(wet).connect(output);

    function rebuildImpulse() {
        rebuild = 0;

        if (pending === built) return;

        built = pending;
        convolver.buffer = impulse(context, built);
    }

    return {
        dispose(): void {
            cancelAnimationFrame(rebuild);
            [convolver, dry, input, output, wet].forEach(node => node.disconnect());
        },
        input,
        output,
        setParam(name: string, value: number): void {
            if (name === 'decay') {
                pending = value;

                if (pending !== built && rebuild === 0) rebuild = requestAnimationFrame(rebuildImpulse);
            }

            if (name === 'wet') {
                smooth(context, dry.gain, 1 - value);
                smooth(context, wet.gain, value);
            }
        },
    };
}

function buildSaturator(context: AudioContext) {
    const input = context.createGain();
    const makeup = context.createGain();
    const shaper = context.createWaveShaper();

    let built = SATURATOR_DRIVE_DEFAULT;
    let pending = SATURATOR_DRIVE_DEFAULT;
    let reshape = 0;

    makeup.gain.value = makeupFor(built);
    shaper.curve = saturationCurve(built);
    shaper.oversample = '4x';
    input.connect(shaper).connect(makeup);

    function rebuildCurve() {
        reshape = 0;

        if (pending === built) return;

        built = pending;
        shaper.curve = saturationCurve(built);
    }

    return {
        dispose(): void {
            cancelAnimationFrame(reshape);
            [input, makeup, shaper].forEach(node => node.disconnect());
        },
        input,
        output: makeup,
        setParam(name: string, value: number): void {
            if (name !== 'drive') return;

            pending = value;

            if (pending !== built && reshape === 0) reshape = requestAnimationFrame(rebuildCurve);

            smooth(context, makeup.gain, makeupFor(value));
        },
    };
}

function buildTuner(context: AudioContext) {
    const analyser = context.createAnalyser();

    analyser.fftSize = ANALYSER_FFT;

    const data = new Float32Array(analyser.fftSize);

    let display = '\u2014';
    let phase = 0;

    return {
        analyser,
        dispose: () => analyser.disconnect(),
        input: analyser,
        output: analyser,
        setParam: () => undefined,
        state: () => display,
        tick(): void {
            phase = (phase + 1) % TICK_INTERVAL;

            if (phase !== 0) return;

            analyser.getFloatTimeDomainData(data);

            const hertz = detectPitch(data, context.sampleRate);

            display = hertz > 0 ? formatPitch(hertz) : '\u2014';
        },
    };
}

function detectPitch(data: Float32Array, sampleRate: number) {
    let power = 0;

    for (let index = 0; index < data.length; index += 1) power += data[index] * data[index];

    if (Math.sqrt(power / data.length) < MIN_RMS) return 0;

    const maxLag = Math.min(Math.floor(sampleRate / PITCH_MIN_HERTZ), Math.floor(data.length / 2));
    const minLag = Math.ceil(sampleRate / PITCH_MAX_HERTZ);

    let bestCorrelation = 0;
    let bestLag = 0;

    for (let lag = minLag; lag <= maxLag; lag += 1) {
        let correlation = 0;

        for (let index = 0; index < data.length - lag; index += 1) correlation += data[index] * data[index + lag];

        correlation /= power;

        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestLag = lag;
        }
    }

    return bestCorrelation > PITCH_MIN_CORRELATION && bestLag > 0 ? sampleRate / bestLag : 0;
}

function fade(context: AudioContext, param: AudioParam, target: number, seconds: number) {
    const now = context.currentTime;

    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + seconds);
}

function formatPitch(hertz: number) {
    const midi = Math.round(MIDI_A4 + SEMITONES_PER_OCTAVE * Math.log2(hertz / TUNING_HERTZ));
    const target = TUNING_HERTZ * 2 ** ((midi - MIDI_A4) / SEMITONES_PER_OCTAVE);
    const cents = Math.round(CENTS_PER_OCTAVE * Math.log2(hertz / target));
    const note = `${NOTE_NAMES[((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE]}${Math.floor(midi / SEMITONES_PER_OCTAVE) - MIDI_OCTAVE_OFFSET}`;

    return `${hertz.toFixed(1)} Hz \u00b7 ${note} ${cents >= 0 ? '+' : ''}${cents}`;
}

function impulse(context: AudioContext, seconds: number) {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);

        for (let index = 0; index < length; index += 1) {
            samples[index] = (Math.random() * 2 - 1) * Math.exp(-IMPULSE_SHAPE * index / length);
        }
    }

    return buffer;
}

export function isAnalysisKind(kind: SandboxKind): boolean {
    return kind === 'meter' || kind === 'tuner';
}

function makeupFor(drive: number) {
    return Math.min(1, 1 / Math.sqrt(drive));
}

function rootMeanSquare(data: Float32Array) {
    let power = 0;

    for (let index = 0; index < data.length; index += 1) power += data[index] * data[index];

    return Math.sqrt(power / data.length);
}

function saturationCurve(drive: number) {
    const samples = new Float32Array(CURVE_LENGTH);
    const scale = Math.tanh(drive);

    for (let index = 0; index < CURVE_LENGTH; index += 1) {
        const x = (index / (CURVE_LENGTH - 1)) * 2 - 1;

        samples[index] = Math.tanh(drive * x) / scale;
    }

    return samples;
}

function smooth(context: AudioContext, param: AudioParam, value: number) {
    param.setTargetAtTime(value, context.currentTime, SMOOTHING);
}

function wrapStage(context: AudioContext, block: SandboxBlock) {
    const dry = context.createGain();
    const input = context.createGain();
    const output = context.createGain();
    const wet = context.createGain();

    dry.gain.value = 0;
    wet.gain.value = 1;
    input.connect(block.input);
    block.output.connect(wet).connect(output);
    input.connect(dry).connect(output);

    return {
        dispose: () => [dry, input, output, wet].forEach(node => node.disconnect()),
        input,
        output,
        set(enabled: boolean): void {
            smooth(context, dry.gain, enabled ? 0 : 1);
            smooth(context, wet.gain, enabled ? 1 : 0);
        },
    };
}
