import { UPLOAD } from '@lib/shared/constants';
import { formatBytes } from '@lib/shared/utils';

const PEAK_COUNT = 200;
const QUEUE_FULL_MESSAGE = `You can queue ${UPLOAD.maxFiles} files at a time.`;
const UPLOAD_EXTENSIONS_OR_LIST = formatExtensions(UPLOAD.extensions);

let audioContext: AudioContext | undefined;

function acceptFiles(files: FileList | File[], queued: UploadEntry[]): UploadEntry[] {
    const accepted = [...queued];
    const created: UploadEntry[] = [];

    Array.from(files).forEach((file) => {
        const error = rejectionReason(file, accepted);

        const entry: UploadEntry = {
            file,
            id: crypto.randomUUID(),
            loadedBytes: 0,
            status: error ? 'rejected' : 'queued',
            totalBytes: file.size,
        };

        if (error) entry.error = error;
        if (!error) accepted.push(entry);

        created.push(entry);
    });

    return created;
}

async function decodePeaks(buffer: ArrayBuffer) {
    if (typeof AudioContext === 'undefined') return null;

    try {
        audioContext ??= new AudioContext();

        const decoded = await audioContext.decodeAudioData(buffer);

        return { durationSeconds: decoded.duration, peaks: extractPeaks(decoded) };
    } catch {
        return null;
    }
}

function extractPeaks(buffer: AudioBuffer) {
    const channel = buffer.getChannelData(0);

    const blockSize = Math.max(1, Math.floor(channel.length / PEAK_COUNT));
    const peaks = new Float32Array(PEAK_COUNT);

    for (let index = 0; index < PEAK_COUNT; index += 1) {
        const start = index * blockSize;

        let peak = 0;

        for (let offset = 0; offset < blockSize; offset += 1) {
            const value = Math.abs(channel[start + offset] ?? 0);

            if (value > peak) peak = value;
        }

        peaks[index] = peak;
    }

    return peaks;
}

function formatExtensions(extensions: readonly string[]) {
    const names = extensions
        .filter(extension => !extensions.some(other => other !== extension && other.startsWith(extension)))
        .map(extension => extension.toUpperCase());

    const last = names.pop() ?? '';

    return names.length > 0 ? `${names.join(', ')} or ${last}` : last;
}

function getExtension(name: string): string {
    const index = name.lastIndexOf('.');

    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
}

function getSizeError(file: File, limit: number): string | undefined {
    if (file.size === 0) return 'That file is empty.';

    if (file.size > limit) return `That file is ${formatBytes(file.size)} \u2014 the limit is ${formatBytes(limit)}.`;

    return undefined;
}

function isDuplicate(file: File, queued: UploadEntry[]) {
    return queued.some(entry => entry.file.lastModified === file.lastModified
        && entry.file.name === file.name
        && entry.file.size === file.size);
}

function readArrayBuffer(file: File, options: UploadOptions) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();

        options.signal.addEventListener('abort', () => reader.abort(), { once: true });
        reader.addEventListener('abort', () => reject(new Error('Cancelled.')));
        reader.addEventListener('error', () => reject(new Error('That file could not be read.')));
        reader.addEventListener('load', () => resolve(toArrayBuffer(reader.result)));
        reader.addEventListener('progress', event => options.onProgress(event.loaded, event.total || file.size));
        reader.readAsArrayBuffer(file);
    });
}

function rejectionReason(file: File, queued: UploadEntry[]) {
    const extension = getExtension(file.name);
    const oversize = getSizeError(file, UPLOAD.maxFileBytes);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'} \u2014 we take ${UPLOAD_EXTENSIONS_OR_LIST}.`;
    }

    if (file.type.length > 0 && !file.type.startsWith('audio/') && !UPLOAD.acceptAttribute.includes(file.type)) {
        return 'That does not look like an audio file.';
    }

    if (oversize) return oversize;

    if (queued.length >= UPLOAD.maxFiles) return QUEUE_FULL_MESSAGE;

    if (totalBytes(queued) + file.size > UPLOAD.maxTotalBytes) {
        return `That would take the queue over ${formatBytes(UPLOAD.maxTotalBytes)}.`;
    }

    return isDuplicate(file, queued) ? 'That file is already in the queue.' : '';
}

function releaseAudioContext(): void {
    if (!audioContext) return;

    const context = audioContext;

    audioContext = undefined;
    void context.close();
}

function toArrayBuffer(result: ArrayBuffer | null | string) {
    return result instanceof ArrayBuffer ? result : new ArrayBuffer(0);
}

function totalBytes(queued: UploadEntry[]) {
    return queued.reduce((total, entry) => total + entry.totalBytes, 0);
}

async function uploadSubmission(file: File, options: UploadOptions): Promise<UploadResult> {
    const entry: UploadEntry = {
        file,
        id: crypto.randomUUID(),
        loadedBytes: 0,
        status: 'reading',
        totalBytes: file.size,
    };

    let buffer: ArrayBuffer;

    try {
        buffer = await readArrayBuffer(file, options);
    } catch (error) {
        return { message: error instanceof Error ? error.message : 'That file could not be read.', ok: false };
    }

    if (file.name.toLowerCase().includes(UPLOAD.failureTrigger)) {
        return { message: 'Transfer failed. Remove the file and try again.', ok: false };
    }

    entry.loadedBytes = file.size;
    entry.status = 'ready';
    options.onProgress(file.size, file.size);

    if (file.size > UPLOAD.maxDecodeBytes) return { entry, ok: true };

    const decoded = await decodePeaks(buffer);

    if (decoded) {
        entry.durationSeconds = decoded.durationSeconds;
        entry.peaks = decoded.peaks;
    }

    return { entry, ok: true };
}

export {
    QUEUE_FULL_MESSAGE,
    UPLOAD_EXTENSIONS_OR_LIST,
    acceptFiles,
    formatExtensions,
    getExtension,
    getSizeError,
    releaseAudioContext,
    uploadSubmission,
};
