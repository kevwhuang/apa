export interface RackAudio {
    context: AudioContext;
    master: GainNode;
}

const MASTER_LEVEL = 0.9;

const MUTE_RAMP = 0.01;

let audio: RackAudio | undefined;
let muted = false;
let volume = 1;

export function ensureRackAudio(): RackAudio {
    if (!audio) {
        const context = new AudioContext();
        const master = context.createGain();

        master.gain.value = muted ? 0 : MASTER_LEVEL * volume;
        master.connect(context.destination);
        audio = { context, master };
    }

    if (audio.context.state === 'suspended') void audio.context.resume();

    return audio;
}

export function setRackMuted(next: boolean): void {
    muted = next;

    if (audio) audio.master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL * volume, audio.context.currentTime, MUTE_RAMP);
}

export function setRackVolume(fraction: number): void {
    volume = Math.min(Math.max(0, fraction), 1);

    if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL * volume, audio.context.currentTime, MUTE_RAMP);
}

export function suspendRackAudio(): void {
    if (audio && audio.context.state === 'running') void audio.context.suspend();
}
