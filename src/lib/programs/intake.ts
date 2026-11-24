import { applyInstantly } from '@lib/shared/utils';
import { isSwitchClosed, isSwitchOpen, onSwitchChange } from '@lib/programs/switches';

function bindIntake(board: IntakeBoard, signal: AbortSignal): void {
    syncIntake(board);
    signal.addEventListener('abort', onSwitchChange(() => syncIntake(board)), { once: true });
}

function syncIntake(board: IntakeBoard) {
    const isClosed = isSwitchClosed(`${board}_intake`);
    const isOpen = isSwitchOpen(`${board}_intake`);

    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-intake-control]').forEach((control) => {
        if (control.disabled === !isOpen) return;

        applyInstantly(control, () => {
            control.disabled = !isOpen;
        });
    });

    document.querySelectorAll<HTMLElement>('[data-intake-note]').forEach((note) => {
        note.hidden = !isClosed;
    });
}

export { bindIntake };
