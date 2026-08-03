import { BYTES_PER_MEGABYTE, UPLOAD } from '@lib/constants';
import { UPLOAD_EXTENSIONS_OR_LIST, getExtension, getSizeError } from '@lib/audio/uploads';
import { ensureRackAudio } from '@lib/audio/rack/context';

const ABORTED_MESSAGE = 'The rack closed before that file finished.';

const MAX_RACK_MEGABYTES = 100;

export const RACK_EXTENSION_LIST = UPLOAD_EXTENSIONS_OR_LIST;

export const RACK_MAX_BYTES = MAX_RACK_MEGABYTES * BYTES_PER_MEGABYTE;

export async function decodeRackFile(file: File, signal?: AbortSignal): Promise<RackLoadResult> {
    const invalid = validateRackFile(file);

    if (invalid) return { message: invalid, ok: false };

    try {
        const bytes = await file.arrayBuffer();

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        const { context } = ensureRackAudio();
        const buffer = await context.decodeAudioData(bytes);

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        return { buffer, ok: true };
    } catch {
        return { message: 'That file could not be decoded.', ok: false };
    }
}

export function validateRackFile(file: File): string | undefined {
    const extension = getExtension(file.name);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'} \u2014 we take ${RACK_EXTENSION_LIST}.`;
    }

    return getSizeError(file, RACK_MAX_BYTES);
}
