import { isSwitchOpen, onSwitchChange } from '@lib/programs/switches';

function bindIntake(board: IntakeBoard, signal: AbortSignal): void {
    function sync() {
        const isClosed = !isSwitchOpen(`${board}_intake`);

        document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-intake-control]').forEach((control) => {
            control.disabled = isClosed;
        });

        document.querySelectorAll<HTMLElement>('[data-intake-note]').forEach((note) => {
            note.hidden = !isClosed;
        });
    }

    sync();
    signal.addEventListener('abort', onSwitchChange(sync), { once: true });
}

export { bindIntake };
