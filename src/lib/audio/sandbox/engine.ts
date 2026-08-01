import { buildBlock, isAnalysisKind } from '@lib/audio/sandbox/blocks';
import { buildChain } from '@lib/audio/sandbox/chain';
import { ensureSandboxAudio, suspendSandboxAudio } from '@lib/audio/sandbox/context';

interface EngineEntry {
    block: SandboxBlock;
    buffer?: AudioBuffer;
    bypassed: boolean;
    chain: SandboxChain;
    onFrame?: () => void;
    onStopped?: () => void;
}

const FADE_SECONDS = 0.012;

const STOP_SECONDS = 0.015;

export function createSandboxEngine(): SandboxEngine {
    const entries = new Set<EngineEntry>();

    let active: { entry: EngineEntry; source: AudioBufferSourceNode } | undefined;
    let disposed = false;
    let frame = 0;

    function loop() {
        if (!active) return;

        if (!active.entry.bypassed) active.entry.block.tick?.();

        active.entry.onFrame?.();
        frame = requestAnimationFrame(loop);
    }

    function start(entry: EngineEntry) {
        if (!entry.buffer || disposed) return;

        const { context } = ensureSandboxAudio();

        stopActive(active?.entry !== entry);

        const source = context.createBufferSource();
        const { gain } = entry.chain.input;
        const now = context.currentTime;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(1, now);
        entry.chain.restoreTails();
        source.buffer = entry.buffer;
        source.loop = true;
        source.connect(entry.chain.input);
        source.start();
        active = { entry, source };
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(loop);
    }

    function stopActive(notify: boolean) {
        if (!active) return;

        const { entry, source } = active;
        const { gain } = entry.chain.input;
        const now = source.context.currentTime;

        active = undefined;
        cancelAnimationFrame(frame);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        entry.chain.flushTails();

        try {
            source.stop(now + STOP_SECONDS);
            source.addEventListener('ended', () => source.disconnect(), { once: true });
        } catch {
            source.disconnect();
        }

        if (notify) entry.onStopped?.();
    }

    return {
        createModule(kind: SandboxKind, hooks?: SandboxModuleHooks): SandboxModule {
            const { context, master } = ensureSandboxAudio();
            const block = buildBlock(kind, context);
            const chain = buildChain(context, block, master, isAnalysisKind(kind));
            const entry: EngineEntry = {
                block,
                bypassed: false,
                chain,
                onFrame: hooks?.onFrame,
                onStopped: hooks?.onStopped,
            };

            entries.add(entry);

            return {
                block,
                bypass(bypassed: boolean): void {
                    entry.bypassed = bypassed;
                    chain.setBypass(bypassed);
                },
                isBypassed: () => entry.bypassed,
                isPlaying: () => active?.entry === entry,
                setBuffer(buffer: AudioBuffer): void {
                    const playing = active?.entry === entry;

                    entry.buffer = buffer;

                    if (playing) start(entry);
                },
                setParam: (name, value) => block.setParam(name, value),
                start: () => start(entry),
                stop(): void {
                    if (active?.entry === entry) stopActive(false);
                },
            };
        },
        dispose(): void {
            disposed = true;
            stopActive(false);
            entries.forEach(entry => entry.chain.dispose());
            entries.clear();
            suspendSandboxAudio();
        },
    };
}
