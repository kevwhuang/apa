const TOAST_TOPIC = 'apa:toast';

function toast(message: string, tone: ToastTone = 'info'): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(TOAST_TOPIC, { detail: { message, tone } }));
}

export { TOAST_TOPIC, toast };
