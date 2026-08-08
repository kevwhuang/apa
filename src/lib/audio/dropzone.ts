import { QUEUE_FULL_MESSAGE, acceptFiles, releaseAudioContext, uploadSubmission } from '@lib/audio/uploads';
import { STORAGE } from '@lib/shared/constants';
import { formatBytes, formatDuration, preventNavigation, setText } from '@lib/shared/utils';

interface Dropzone {
    clear: () => void;
    entries: () => UploadEntry[];
    size: () => number;
}

interface DropzoneElements {
    input: HTMLInputElement;
    list: HTMLElement;
    zone: HTMLElement;
}

interface DropzoneMessages {
    failed: (name: string, reason: string) => string;
    full: () => string;
    ready: (name: string) => string;
    rejected: (name: string, reason: string) => string;
    removed: (name: string) => string;
}

interface DropzoneOptions {
    accept?: string;
    capacity?: () => number;
    drawWaveform?: (canvas: HTMLCanvasElement, peaks: Float32Array) => void;
    messages?: Partial<DropzoneMessages>;
    onQueueChange?: (entries: UploadEntry[]) => void;
    selectors?: Partial<DropzoneSelectors>;
    signal: AbortSignal;
}

interface DropzoneSelectors {
    input: string;
    list: string;
    row: string;
    status: string;
    zone: string;
}

interface QueuedUpload {
    controller: AbortController;
    entry: UploadEntry;
    row: HTMLElement;
}

const DEFAULT_MESSAGES: DropzoneMessages = {
    failed: (name, reason) => `${name} failed: ${reason}`,
    full: () => QUEUE_FULL_MESSAGE,
    ready: name => `${name} ready.`,
    rejected: (name, reason) => `${name} rejected: ${reason}`,
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

function createDropzone(options: DropzoneOptions): Dropzone | null {
    const selectors = { ...DEFAULT_SELECTORS, ...options.selectors };

    const input = document.querySelector<HTMLInputElement>(selectors.input);
    const list = document.querySelector<HTMLElement>(selectors.list);
    const zone = document.querySelector<HTMLElement>(selectors.zone);

    if (!input || !list || !zone) return null;

    return startDropzone({ input, list, zone }, selectors, options);
}

function describeEntry(entry: UploadEntry) {
    return [formatBytes(entry.totalBytes), entry.durationSeconds ? formatDuration(entry.durationSeconds) : '']
        .filter(Boolean)
        .join(' \u00b7 ');
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: Float32Array): void {
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

function nextFocusTarget(row: HTMLElement, fallback: string): HTMLElement | null {
    const after = row.nextElementSibling?.querySelector<HTMLElement>(ROW_CONTROL_SELECTOR);
    const before = row.previousElementSibling?.querySelector<HTMLElement>(ROW_CONTROL_SELECTOR);

    return after ?? before ?? document.querySelector<HTMLElement>(fallback);
}

function setCancelLabel(row: HTMLElement, entry: UploadEntry, reading: boolean) {
    const cancel = row.querySelector<HTMLButtonElement>('[data-row-cancel]');

    if (!cancel) return;

    cancel.textContent = reading ? 'Cancel' : 'Remove';
    cancel.setAttribute('aria-label', `${reading ? 'Cancel' : 'Remove'} ${entry.file.name}`);
}

function startDropzone(elements: DropzoneElements, selectors: DropzoneSelectors, options: DropzoneOptions) {
    const { input, list, zone } = elements;
    const { onQueueChange, signal } = options;
    const draw = options.drawWaveform ?? drawWaveform;
    const messages = { ...DEFAULT_MESSAGES, ...options.messages };

    let depth = 0;
    let queue: QueuedUpload[] = [];

    function announce(message: string) {
        setText(document.querySelector(selectors.status), message);
    }

    function clear() {
        queue.forEach(item => item.controller.abort());
        depth = 0;
        queue = [];
        list.replaceChildren();
        notify();
    }

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();
        zone.classList.add('is-dragging');
        depth += 1;
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

        if (files && files.length > 0) intake(files);
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

    function handleRemove(entry: UploadEntry, row: HTMLElement) {
        const queued = queue.find(item => item.entry.id === entry.id);
        const target = nextFocusTarget(row, selectors.input);

        queued?.controller.abort();
        row.remove();
        queue = queue.filter(item => item.entry.id !== entry.id);
        notify();
        target?.focus();
        announce(messages.removed(entry.file.name));

        if (queue.length === 0) releaseAudioContext();
    }

    function handleThemeChange() {
        queue.forEach(({ entry, row }) => {
            const canvas = row.querySelector<HTMLCanvasElement>('[data-row-canvas]');

            if (canvas && entry.peaks) draw(canvas, entry.peaks);
        });
    }

    function intake(files: File[] | FileList) {
        const room = options.capacity?.();
        const source = Array.from(files);

        const batch = room === undefined ? source : source.slice(0, Math.max(0, room));

        const created = [...acceptFiles(batch, queue.map(item => item.entry)), ...overflowEntries(source.slice(batch.length))];

        let accepted = 0;

        created.forEach((entry) => {
            const row = renderRow(entry);

            if (!row) return;

            if (entry.status === 'rejected') {
                announce(messages.rejected(entry.file.name, entry.error ?? 'not accepted'));

                return;
            }

            accepted += 1;
            queue.push({ controller: new AbortController(), entry, row });
            void readEntry(entry, row);
        });

        if (accepted === 0) return;

        notify();
    }

    function notify() {
        onQueueChange?.(queue.map(item => item.entry));
    }

    function overflowEntries(files: File[]): UploadEntry[] {
        return files.map(file => ({
            error: messages.full(),
            file,
            id: crypto.randomUUID(),
            loadedBytes: 0,
            status: 'rejected',
            totalBytes: file.size,
        }));
    }

    async function readEntry(entry: UploadEntry, row: HTMLElement) {
        const canvas = row.querySelector<HTMLCanvasElement>('[data-row-canvas]');
        const error = row.querySelector<HTMLElement>('[data-row-error]');
        const meta = row.querySelector<HTMLElement>('[data-row-meta]');
        const queued = queue.find(item => item.entry.id === entry.id);

        if (!queued) return;

        entry.status = 'reading';
        setCancelLabel(row, entry, true);

        const result = await uploadSubmission(entry.file, {
            onProgress: (loadedBytes, totalBytes) => updateProgress(row, entry, loadedBytes, totalBytes),
            signal: queued.controller.signal,
        });

        if (!queue.some(item => item.entry.id === entry.id)) return;

        if (!result.ok) {
            entry.status = 'failed';
            setCancelLabel(row, entry, false);
            setText(error, result.message);
            error?.removeAttribute('hidden');
            announce(messages.failed(entry.file.name, result.message));

            return;
        }

        entry.durationSeconds = result.entry.durationSeconds;
        entry.loadedBytes = entry.totalBytes;
        entry.peaks = result.entry.peaks;
        entry.status = 'ready';

        setCancelLabel(row, entry, false);
        setText(meta, describeEntry(entry));

        if (canvas && entry.peaks) draw(canvas, entry.peaks);

        announce(messages.ready(entry.file.name));
    }

    function renderRow(entry: UploadEntry) {
        const template = document.querySelector<HTMLTemplateElement>(selectors.row);

        if (!template) return null;

        const fragment = template.content.cloneNode(true) as DocumentFragment;

        const row = fragment.querySelector<HTMLElement>('li');

        if (!row) return null;

        const cancel = row.querySelector<HTMLButtonElement>('[data-row-cancel]');
        const error = row.querySelector<HTMLElement>('[data-row-error]');
        const progress = row.querySelector<HTMLProgressElement>('[data-row-progress]');

        progress?.setAttribute('aria-label', `Read progress for ${entry.file.name}`);
        setText(row.querySelector('[data-row-meta]'), describeEntry(entry));
        setText(row.querySelector('[data-row-name]'), entry.file.name);

        if (entry.status === 'rejected') {
            setText(error, entry.error ?? 'That file was not accepted.');
            error?.removeAttribute('hidden');
            progress?.setAttribute('hidden', '');
        }

        cancel?.addEventListener('click', () => handleRemove(entry, row), { signal });
        setCancelLabel(row, entry, false);
        list.append(fragment);

        return row;
    }

    if (options.accept) input.accept = options.accept;

    list.replaceChildren();
    input.addEventListener('change', handleInputChange, { signal });
    input.addEventListener('keydown', handleInputKeydown, { signal });
    signal.addEventListener('abort', releaseAudioContext, { once: true });
    window.addEventListener(STORAGE.theme.topic, handleThemeChange, { signal });
    window.addEventListener('dragover', preventNavigation, { signal });
    window.addEventListener('drop', preventNavigation, { signal });
    zone.addEventListener('dragenter', handleDragEnter, { signal });
    zone.addEventListener('dragleave', handleDragLeave, { signal });
    zone.addEventListener('dragover', preventNavigation, { signal });
    zone.addEventListener('drop', handleDrop, { signal });

    return {
        clear,
        entries: () => queue.map(item => item.entry),
        size: () => queue.length,
    };
}

function updateProgress(row: HTMLElement, entry: UploadEntry, loadedBytes: number, totalBytes: number) {
    const percent = Math.round(loadedBytes / Math.max(1, totalBytes) * PERCENT);
    const progress = row.querySelector<HTMLProgressElement>('[data-row-progress]');

    entry.loadedBytes = loadedBytes;

    if (progress) progress.value = percent;

    setText(row.querySelector('[data-row-percent]'), `${percent}%`);
}

export { createDropzone, drawWaveform, nextFocusTarget };
export type { Dropzone, DropzoneMessages, DropzoneOptions, DropzoneSelectors };
