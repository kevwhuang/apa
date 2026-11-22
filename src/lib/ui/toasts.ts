const TOAST_RETRACT_TOPIC = 'apa:toast-retract';
const TOAST_TOPIC = 'apa:toast';

function retractToast(message: string): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(TOAST_RETRACT_TOPIC, { detail: { message, tone: 'error' } }));
}

function toast(message: string, tone: ToastTone): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(TOAST_TOPIC, { detail: { message, tone } }));
}

export { TOAST_RETRACT_TOPIC, TOAST_TOPIC, retractToast, toast };
