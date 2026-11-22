import { sendRequest } from '@lib/shared/request';
import { toast } from '@lib/ui/toasts';

const cleared = new WeakSet<HTMLAnchorElement>();
const pending = new WeakSet<HTMLAnchorElement>();

let isRegistered = false;

async function handleDownloadClick(event: MouseEvent) {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[download]') : null;

    if (!link || link.origin !== window.location.origin || cleared.delete(link)) return;

    event.preventDefault();

    if (pending.has(link)) return;

    pending.add(link);

    const result = await sendRequest(link.href, { method: 'HEAD' });

    pending.delete(link);

    if (!result.ok) {
        toast(result.message, 'error');

        return;
    }

    cleared.add(link);
    link.click();
}

function initDownloads(): void {
    if (isRegistered) return;

    isRegistered = true;
    document.addEventListener('click', event => void handleDownloadClick(event));
}

export { initDownloads };
