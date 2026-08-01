const CROSSFADE_SECONDS = 0.015;

export function buildChain(context: AudioContext, block: SandboxBlock, destination: AudioNode, analysis: boolean): SandboxChain {
    const dry = context.createGain();
    const input = context.createGain();
    const wet = context.createGain();

    dry.gain.value = 0;
    wet.gain.value = 1;
    input.connect(block.input);
    block.output.connect(wet).connect(destination);

    if (!analysis) input.connect(dry).connect(destination);

    return {
        dispose(): void {
            block.dispose();
            dry.disconnect();
            input.disconnect();
            wet.disconnect();
        },
        flushTails: () => block.flushTails?.(),
        input,
        restoreTails: () => block.restoreTails?.(),
        setBypass(bypassed: boolean): void {
            if (analysis) return;

            ramp(context, dry.gain, bypassed ? 1 : 0);
            ramp(context, wet.gain, bypassed ? 0 : 1);
        },
    };
}

function ramp(context: AudioContext, param: AudioParam, target: number) {
    const now = context.currentTime;

    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + CROSSFADE_SECONDS);
}
