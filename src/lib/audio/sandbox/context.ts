export interface SandboxAudio {
    context: AudioContext;
    master: GainNode;
}

const MASTER_LEVEL = 0.9;

let audio: SandboxAudio | undefined;

export function ensureSandboxAudio(): SandboxAudio {
    if (!audio) {
        const context = new AudioContext();
        const master = context.createGain();

        master.gain.value = MASTER_LEVEL;
        master.connect(context.destination);
        audio = { context, master };
    }

    if (audio.context.state === 'suspended') void audio.context.resume();

    return audio;
}

export function suspendSandboxAudio(): void {
    if (audio && audio.context.state === 'running') void audio.context.suspend();
}
