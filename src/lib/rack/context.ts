const MUTE_RAMP = 0.01;
const RACK_MASTER_LEVEL = 0.9;

let audio: RackAudio | undefined;
let build: (() => void) | undefined;
let feeding = false;
let muted = false;
let volume = 1;

function closeRackChain(): void {
    feeding = false;
}

function ensureRackAudio(): RackAudio {
    if (!audio) {
        const context = new AudioContext();

        const input = context.createGain();
        const master = context.createGain();

        master.gain.value = muted ? 0 : RACK_MASTER_LEVEL * volume;
        input.connect(master);
        master.connect(context.destination);
        audio = { context, input, master };
    }

    if (audio.context.state === 'suspended') void audio.context.resume();

    return audio;
}

function hasChainFeed(): boolean {
    return feeding;
}

function openRackChain(): RackAudio {
    feeding = true;

    const ready = ensureRackAudio();

    build?.();

    return ready;
}

function setRackChainBuilder(builder: () => void): void {
    build = builder;
}

function setRackMuted(next: boolean): void {
    muted = next;

    if (audio) audio.master.gain.setTargetAtTime(next ? 0 : RACK_MASTER_LEVEL * volume, audio.context.currentTime, MUTE_RAMP);
}

function setRackVolume(fraction: number): void {
    volume = Math.min(Math.max(0, fraction), 1);

    if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : RACK_MASTER_LEVEL * volume, audio.context.currentTime, MUTE_RAMP);
}

function suspendRackAudio(): void {
    if (feeding) return;
    if (audio && audio.context.state === 'running') void audio.context.suspend();
}

export {
    RACK_MASTER_LEVEL,
    closeRackChain,
    ensureRackAudio,
    hasChainFeed,
    openRackChain,
    setRackChainBuilder,
    setRackMuted,
    setRackVolume,
    suspendRackAudio,
};
