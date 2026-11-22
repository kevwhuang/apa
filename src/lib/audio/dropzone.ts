import { STORAGE } from '@lib/shared/constants';
import { acceptFiles, releaseAudioContext, uploadSubmission } from '@lib/audio/uploads';
import { formatBytes, formatDuration, preventNavigation, setPending, setText } from '@lib/shared/utils';
import { toast } from '@lib/ui/toasts';

interface DropzoneElements {
    input: HTMLInputElement;
    list: HTMLElement;
    zone: HTMLElement;
}

interface DropzoneMessages {
    failed: (name: string, reason: string) => string;
    ready: (name: string) => string;
    rejected: (name: string, reason: string) => string;
    removed: (name: string) => string;
}

interface DropzoneOptions {
    selectors?: Partial<DropzoneSelectors>;
    signal: AbortSignal;
    store: DropzoneStore;
}

interface DropzoneSelectors {
    input: string;
    list: string;
    row: string;
    status: string;
    zone: string;
}

interface DropzoneStore {
    remove: (id: string) => Promise<SubmissionResult>;
    send: (file: File, options: UploadOptions) => Promise<SubmissionResult>;
}

interface QueuedUpload {
    controller: AbortController;
    entry: UploadEntry;
    row: HTMLElement;
    storedId?: string;
}

interface RestoredUpload {
    entry: BoardEntry;
    row: HTMLElement;
}

const DEFAULT_MESSAGES: DropzoneMessages = {
    failed: (name, reason) => `${name} could not be loaded. ${reason}`,
    ready: name => `${name} ready.`,
    rejected: (name, reason) => `${name} was not added. ${reason}`,
    removed: name => `${name} removed.`,
};

const DEFAULT_SELECTORS: DropzoneSelectors = {
    input: '[data-dropzone-input]',
    list: '[data-dropzone-list]',
    row: '[data-dropzone-row]',
    status: '[data-dropzone-status]',
    zone: '[data-dropzone]',
};

const PERCENT = 100;
const ROW_CONTROL_SELECTOR = '[data-row-cancel], [data-row-remove]';

function createDropzone(options: DropzoneOptions): ((entries: BoardEntry[]) => void) | undefined {
    const selectors = { ...DEFAULT_SELECTORS, ...options.selectors };

    const input = document.querySelector<HTMLInputElement>(selectors.input);
    const list = document.querySelector<HTMLElement>(selectors.list);
    const zone = document.querySelector<HTMLElement>(selectors.zone);

    if (!input || !list || !zone) return undefined;

    return startDropzone({ input, list, zone }, selectors, options);
}

function describeEntry(entry: UploadEntry) {
    return [formatBytes(entry.totalBytes), entry.durationSeconds ? formatDuration(entry.durationSeconds) : ''].filter(Boolean).join(' \u00b7 ');
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: Float32Array) {
    const context = canvas.getContext('2d');

    if (!context) return;

    const middle = canvas.height / 2;
    const step = canvas.width / peaks.length;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = getComputedStyle(canvas).color;

    peaks.forEach((peak, index) => {
        const reach = Math.max(1, peak * middle);

        context.fillRect(index * step, middle - reach, Math.max(1, step - 1), reach * 2);
    });

    canvas.removeAttribute('hidden');
}

function failUpload(queued: QueuedUpload, message: string) {
    const { entry, row } = queued;

    entry.status = 'failed';
    setCancelLabel(row, entry.file.name, false);
    showRowFailure(row);
    toast(message, 'error');
}

function findNextFocusTarget(row: HTMLElement, fallback: string): HTMLElement | null {
    const after = row.nextElementSibling?.querySelector<HTMLElement>(ROW_CONTROL_SELECTOR);
    const before = row.previousElementSibling?.querySelector<HTMLElement>(ROW_CONTROL_SELECTOR);

    return after ?? before ?? document.querySelector<HTMLElement>(fallback);
}

async function removeStored(id: string, button: HTMLButtonElement | null, store: DropzoneStore) {
    setPending(button, true);

    const result = await store.remove(id);

    if (result.ok) return true;

    setPending(button, false);
    toast(result.message, 'error');

    return false;
}

function setCancelLabel(row: HTMLElement, name: string, isReading: boolean) {
    const cancel = row.querySelector<HTMLButtonElement>('[data-row-cancel]');
    const label = isReading ? 'Cancel' : 'Remove';

    if (!cancel) return;

    cancel.textContent = label;
    cancel.setAttribute('aria-label', `${label} ${name}`);
}

function showProgress(row: HTMLElement, percent: number) {
    const progress = row.querySelector<HTMLProgressElement>('[data-row-progress]');

    if (progress) progress.value = percent;

    setText(row.querySelector('[data-row-percent]'), `${percent}%`);
}

function showRowFailure(row: HTMLElement) {
    row.classList.add('is-failed');
    row.querySelector('[data-row-progress]')?.setAttribute('hidden', '');
    setText(row.querySelector('[data-row-percent]'), 'Failed');
}

function startDropzone(elements: DropzoneElements, selectors: DropzoneSelectors, options: DropzoneOptions) {
    const { input, list, zone } = elements;
    const restored = new Map<string, RestoredUpload>();
    const { signal, store } = options;

    let depth = 0;
    let queue: QueuedUpload[] = [];

    function announce(message: string) {
        setText(document.querySelector(selectors.status), message);
    }

    function cancelUnfinished() {
        const unfinished = queue.filter(item => !item.storedId);

        queue = [];
        unfinished.forEach(item => item.controller.abort());
    }

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();

        if (input.disabled) return;

        zone.classList.add('is-dragging');
        depth++;
    }

    function handleDragLeave() {
        depth = Math.max(0, depth - 1);

        if (depth === 0) zone.classList.remove('is-dragging');
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        zone.classList.remove('is-dragging');
        depth = 0;

        const files = event.dataTransfer?.files;

        if (!input.disabled && files && files.length > 0) intake(files);
    }

    function handleInputChange() {
        if (input.files && input.files.length > 0) intake(input.files);

        input.value = '';
    }

    function handleInputKeydown(event: KeyboardEvent) {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        input.click();
    }

    async function handleRemove(queued: QueuedUpload) {
        const { controller, entry, row, storedId } = queued;

        const target = findNextFocusTarget(row, selectors.input);

        if (storedId) {
            const isRemoved = await removeStored(storedId, row.querySelector('[data-row-cancel]'), store);

            if (!isRemoved) return;
        }

        controller.abort();
        row.remove();
        queue = queue.filter(item => item !== queued);
        target?.focus();
        announce(DEFAULT_MESSAGES.removed(entry.file.name));

        if (queue.length === 0) releaseAudioContext();
    }

    async function handleRestoredRemove(restoredUpload: RestoredUpload) {
        const { entry, row } = restoredUpload;

        const target = findNextFocusTarget(row, selectors.input);

        const isRemoved = await removeStored(entry.id, row.querySelector('[data-row-cancel]'), store);

        if (!isRemoved) return;

        row.remove();
        restored.delete(entry.id);
        target?.focus();
        announce(DEFAULT_MESSAGES.removed(entry.source));
    }

    function handleThemeChange() {
        queue.forEach(({ entry, row }) => {
            const canvas = row.querySelector<HTMLCanvasElement>('[data-row-canvas]');

            if (canvas && entry.peaks) drawWaveform(canvas, entry.peaks);
        });
    }

    function intake(files: FileList | File[]) {
        const created = acceptFiles(files, queue.map(item => item.entry), [...restored.values()].map(item => item.entry));

        const rejected = created.filter(entry => entry.status === 'rejected');

        input.setAttribute('aria-invalid', 'false');

        created.forEach((entry) => {
            if (entry.status === 'rejected') return;

            const row = renderRow(entry.file.name, describeEntry(entry));

            if (!row) return;

            const queued: QueuedUpload = { controller: new AbortController(), entry, row };

            row.querySelector('[data-row-cancel]')?.addEventListener('click', () => void handleRemove(queued), { signal });
            setCancelLabel(row, entry.file.name, false);
            queue.push(queued);
            void readEntry(queued);
        });

        if (rejected.length === 0) return;

        input.setAttribute('aria-invalid', 'true');
        input.focus();
        toast(rejected.map(entry => DEFAULT_MESSAGES.rejected(entry.file.name, entry.error ?? 'That file was not accepted.')).join(' '), 'error');
    }

    async function readEntry(queued: QueuedUpload) {
        const { controller, entry, row } = queued;

        const canvas = row.querySelector<HTMLCanvasElement>('[data-row-canvas]');
        const meta = row.querySelector<HTMLElement>('[data-row-meta]');

        entry.status = 'reading';
        setCancelLabel(row, entry.file.name, true);

        const result = await uploadSubmission(entry.file, { signal: controller.signal });

        if (!queue.includes(queued)) return;

        if (!result.ok) {
            failUpload(queued, DEFAULT_MESSAGES.failed(entry.file.name, result.message));

            return;
        }

        entry.durationSeconds = result.entry.durationSeconds;
        entry.peaks = result.entry.peaks;
        setText(meta, describeEntry(entry));

        if (canvas && entry.peaks) drawWaveform(canvas, entry.peaks);

        const sent = await store.send(entry.file, {
            onProgress: (loadedBytes, totalBytes) => updateProgress(row, loadedBytes, totalBytes),
            signal: controller.signal,
        });

        if (!queue.includes(queued)) {
            if (sent.ok) void store.remove(sent.id);

            return;
        }

        if (!sent.ok) {
            failUpload(queued, sent.code === 'signed-out' ? sent.message : DEFAULT_MESSAGES.failed(entry.file.name, sent.message));

            return;
        }

        entry.status = 'ready';
        queued.storedId = sent.id;
        announce(DEFAULT_MESSAGES.ready(entry.file.name));
        restored.get(sent.id)?.row.remove();
        restored.delete(sent.id);
        setCancelLabel(row, entry.file.name, false);
        updateProgress(row, entry.totalBytes, entry.totalBytes);
    }

    function renderRow(name: string, meta: string) {
        const template = document.querySelector<HTMLTemplateElement>(selectors.row);

        if (!template) return null;

        const fragment = template.content.cloneNode(true) as DocumentFragment;

        const row = fragment.querySelector<HTMLElement>('li');

        if (!row) return null;

        row.querySelector('[data-row-progress]')?.setAttribute('aria-label', `Upload progress for ${name}`);
        setText(row.querySelector('[data-row-meta]'), meta);
        setText(row.querySelector('[data-row-name]'), name);
        list.append(fragment);

        return row;
    }

    function restore(entry: BoardEntry) {
        const row = renderRow(entry.source, formatBytes(entry.bytes));

        if (!row) return;

        const restoredUpload: RestoredUpload = { entry, row };

        row.querySelector('[data-row-cancel]')?.addEventListener('click', () => void handleRestoredRemove(restoredUpload), { signal });
        setCancelLabel(row, entry.source, false);
        showProgress(row, PERCENT);
        restored.set(entry.id, restoredUpload);
    }

    function syncStored(entries: BoardEntry[]) {
        const ids = new Set(entries.map(entry => entry.id));

        const removed = queue.filter(item => item.storedId && !ids.has(item.storedId));

        removed.forEach(item => item.row.remove());
        queue = queue.filter(item => !removed.includes(item));

        for (const [id, item] of restored) {
            if (ids.has(id)) continue;

            item.row.remove();
            restored.delete(id);
        }

        entries.forEach((entry) => {
            if (queue.some(item => item.storedId === entry.id) || restored.has(entry.id)) return;

            restore(entry);
        });
    }

    list.replaceChildren();
    input.addEventListener('change', handleInputChange, { signal });
    input.addEventListener('keydown', handleInputKeydown, { signal });
    signal.addEventListener('abort', cancelUnfinished, { once: true });
    signal.addEventListener('abort', releaseAudioContext, { once: true });
    window.addEventListener(STORAGE.theme.topic, handleThemeChange, { signal });
    window.addEventListener('dragover', preventNavigation, { signal });
    window.addEventListener('drop', preventNavigation, { signal });
    zone.addEventListener('dragenter', handleDragEnter, { signal });
    zone.addEventListener('dragleave', handleDragLeave, { signal });
    zone.addEventListener('dragover', preventNavigation, { signal });
    zone.addEventListener('drop', handleDrop, { signal });

    return syncStored;
}

function updateProgress(row: HTMLElement, loadedBytes: number, totalBytes: number) {
    showProgress(row, Math.round(loadedBytes / Math.max(1, totalBytes) * PERCENT));
}

export { createDropzone, findNextFocusTarget };
