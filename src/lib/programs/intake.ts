import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const OPEN_INTAKE: IntakeState = { assembly: true, bash: true };

const store = createStore<IntakeState>({
    fallback: OPEN_INTAKE,
    key: STORAGE.intake.key,
    normalize: normalizeIntake,
    scope: STORAGE.intake.scope,
    topic: STORAGE.intake.topic,
});

function bindIntake(board: IntakeBoard, signal: AbortSignal): void {
    function sync() {
        const isClosed = !isIntakeOpen(board);

        document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-intake-control]').forEach((control) => {
            control.disabled = isClosed;
        });

        document.querySelectorAll<HTMLElement>('[data-intake-note]').forEach((note) => {
            note.hidden = !isClosed;
        });
    }

    sync();
    signal.addEventListener('abort', onIntakeChange(sync), { once: true });
}

function isIntakeOpen(board: IntakeBoard): boolean {
    return store.get()[board];
}

function normalizeIntake(value: IntakeState): IntakeState {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return OPEN_INTAKE;

    return {
        assembly: typeof value.assembly === 'boolean' ? value.assembly : true,
        bash: typeof value.bash === 'boolean' ? value.bash : true,
    };
}

function onIntakeChange(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;

    const controller = new AbortController();
    const unsubscribe = store.onChange(callback);

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE.intake.key || event.key === null) callback();
    }, { signal: controller.signal });

    return () => {
        controller.abort();
        unsubscribe();
    };
}

function setIntakeOpen(board: IntakeBoard, isOpen: boolean): boolean {
    store.update(value => ({ ...value, [board]: isOpen }));

    return store.persisted();
}

export { bindIntake, isIntakeOpen, onIntakeChange, setIntakeOpen };
