import { UPLOAD } from '@lib/shared/constants';
import { formatBytes } from '@lib/shared/utils';

const DECODE_FAILED_MESSAGE = 'That file could not be decoded.';
const ID3_FLAGS_OFFSET = 5;
const ID3_FOOTER_FLAG = 0x10;
const ID3_HEADER_BYTES = 10;
const ID3_SIZE_OFFSETS = [6, 7, 8, 9] as const;
const MPEG_BITRATE_SHIFT = 4;
const MPEG_FIELD_MASK = 0x03;
const MPEG_LAYER_MASK = 0x06;
const MPEG_LAYER_THREE = 0x02;
const MPEG_ONE_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] as const;
const MPEG_ONE_FRAME_FACTOR = 144_000;
const MPEG_ONE_VERSION = 3;
const MPEG_PADDING_SHIFT = 1;
const MPEG_SAMPLE_RATES: readonly (readonly number[])[] = [[11_025, 12_000, 8_000], [], [22_050, 24_000, 16_000], [44_100, 48_000, 32_000]];
const MPEG_SAMPLE_RATE_SHIFT = 2;
const MPEG_SYNC_BYTE = 0xff;
const MPEG_SYNC_MASK = 0xe0;
const MPEG_TWO_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] as const;
const MPEG_TWO_FRAME_FACTOR = 72_000;
const MPEG_VERSION_SHIFT = 3;
const PEAK_COUNT = 200;
const SNIFF_WINDOW_BYTES = 4_096;
const SYNCSAFE_BITS = 7;
const SYNCSAFE_MASK = 0x7f;
const UPLOAD_EXTENSIONS_OR_LIST = formatExtensions(UPLOAD.extensions);
const WAVE_FORMAT_OFFSET = 8;

let audioContext: AudioContext | undefined;

function acceptFiles(files: FileList | File[], queued: UploadEntry[]): UploadEntry[] {
    const accepted = [...queued];
    const created: UploadEntry[] = [];

    Array.from(files).forEach((file) => {
        const error = getRejectionReason(file, accepted);

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
    const peaks = new Float32Array(PEAK_COUNT);

    const blockSize = Math.max(1, Math.floor(channel.length / PEAK_COUNT));

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

function findMpegFrame(bytes: Uint8Array, start: number) {
    const end = Math.min(bytes.length, start + SNIFF_WINDOW_BYTES);

    for (let index = start; index < end; index += 1) {
        const length = readMpegFrameLength(bytes, index);

        const next = index + length;

        if (length > 0 && (next === bytes.length || readMpegFrameLength(bytes, next) > 0)) return true;
    }

    return false;
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

function getFormatError(file: File, buffer: ArrayBuffer): string | undefined {
    const extension = getExtension(file.name);

    return sniffAudioFormat(buffer) === extension ? undefined : `That file does not contain ${extension.toUpperCase()} audio.`;
}

function getRejectionReason(file: File, queued: UploadEntry[]) {
    const extension = getExtension(file.name);
    const sizeError = getSizeError(file, UPLOAD.maxFileBytes);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'}. We take ${UPLOAD_EXTENSIONS_OR_LIST}.`;
    }

    if (file.type.length > 0 && !file.type.startsWith('audio/') && !UPLOAD.acceptAttribute.includes(file.type)) {
        return 'That does not look like an audio file.';
    }

    if (sizeError) return sizeError;

    const isDuplicate = queued.some(entry => entry.file.lastModified === file.lastModified
        && entry.file.name === file.name
        && entry.file.size === file.size);

    return isDuplicate ? 'That file is already in the queue.' : '';
}

function getSizeError(file: File, limit: number): string | undefined {
    if (file.size === 0) return 'That file is empty.';

    if (file.size > limit) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)}.`;

    return undefined;
}

function readArrayBuffer(file: File, options: UploadOptions) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();

        options.signal.addEventListener('abort', () => reader.abort(), { once: true });
        reader.addEventListener('abort', () => reject(new Error('Canceled.')));
        reader.addEventListener('error', () => reject(new Error('That file could not be read.')));
        reader.addEventListener('load', () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0)));
        reader.addEventListener('progress', event => options.onProgress?.(event.loaded, event.total || file.size));
        reader.readAsArrayBuffer(file);
    });
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
    return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readId3Length(bytes: Uint8Array) {
    if (readAscii(bytes, 0, 3) !== 'ID3') return 0;

    const footer = ((bytes[ID3_FLAGS_OFFSET] ?? 0) & ID3_FOOTER_FLAG) === 0 ? 0 : ID3_HEADER_BYTES;
    const size = ID3_SIZE_OFFSETS.reduce((total, offset) => (total << SYNCSAFE_BITS) | ((bytes[offset] ?? 0) & SYNCSAFE_MASK), 0);

    return ID3_HEADER_BYTES + size + footer;
}

function readMpegFrameLength(bytes: Uint8Array, offset: number) {
    const flags = bytes[offset + 1] ?? 0;
    const rates = bytes[offset + 2] ?? 0;

    if (bytes[offset] !== MPEG_SYNC_BYTE || (flags & MPEG_LAYER_MASK) !== MPEG_LAYER_THREE || (flags & MPEG_SYNC_MASK) !== MPEG_SYNC_MASK) return 0;

    const version = (flags >> MPEG_VERSION_SHIFT) & MPEG_FIELD_MASK;

    const isMpegOne = version === MPEG_ONE_VERSION;
    const sampleRate = MPEG_SAMPLE_RATES[version]?.[(rates >> MPEG_SAMPLE_RATE_SHIFT) & MPEG_FIELD_MASK] ?? 0;

    const bitrate = (isMpegOne ? MPEG_ONE_BITRATES : MPEG_TWO_BITRATES)[rates >> MPEG_BITRATE_SHIFT] ?? 0;

    if (bitrate === 0 || sampleRate === 0) return 0;

    const padding = (rates >> MPEG_PADDING_SHIFT) & 1;

    return Math.floor((isMpegOne ? MPEG_ONE_FRAME_FACTOR : MPEG_TWO_FRAME_FACTOR) * bitrate / sampleRate) + padding;
}

function releaseAudioContext(): void {
    if (!audioContext) return;

    const context = audioContext;

    audioContext = undefined;
    void context.close();
}

function sniffAudioFormat(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);

    if (readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, WAVE_FORMAT_OFFSET, 4) === 'WAVE') return 'wav';

    return findMpegFrame(bytes, readId3Length(bytes)) ? 'mp3' : '';
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

    const formatError = getFormatError(file, buffer);

    if (formatError) return { message: formatError, ok: false };

    if (file.name.toLowerCase().includes(UPLOAD.failureTrigger)) {
        return { message: 'Transfer failed. Remove the file and try again.', ok: false };
    }

    entry.loadedBytes = file.size;
    entry.status = 'ready';
    options.onProgress?.(file.size, file.size);

    if (file.size > UPLOAD.maxDecodeBytes || typeof AudioContext === 'undefined') return { entry, ok: true };

    const decoded = await decodePeaks(buffer);

    if (!decoded) return { message: DECODE_FAILED_MESSAGE, ok: false };

    entry.durationSeconds = decoded.durationSeconds;
    entry.peaks = decoded.peaks;

    return { entry, ok: true };
}

export {
    UPLOAD_EXTENSIONS_OR_LIST,
    acceptFiles,
    formatExtensions,
    getExtension,
    getFormatError,
    getSizeError,
    releaseAudioContext,
    uploadSubmission,
};
