import { UPLOAD } from '@lib/shared/constants';
import { UPLOAD_EXTENSIONS_OR_LIST, getExtension, getFormatError, getSizeError } from '@lib/audio/uploads';
import { ensureRackAudio } from '@lib/rack/context';

const ABORTED_MESSAGE = 'The rack closed before that file finished.';
const RACK_EXTENSION_LIST = UPLOAD_EXTENSIONS_OR_LIST;
const RACK_MAX_BYTES = UPLOAD.maxFileBytes;

async function decodeRackFile(file: File, signal?: AbortSignal): Promise<RackLoadResult> {
    const invalid = validateRackFile(file);

    if (invalid) return { message: invalid, ok: false };

    try {
        const bytes = await file.arrayBuffer();

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        const formatError = getFormatError(file, bytes);

        if (formatError) return { message: formatError, ok: false };

        const { context } = ensureRackAudio();

        const buffer = await context.decodeAudioData(bytes);

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        return { buffer, ok: true };
    } catch {
        return { message: 'That file could not be decoded.', ok: false };
    }
}

function validateRackFile(file: File): string | undefined {
    const extension = getExtension(file.name);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'}. We take ${RACK_EXTENSION_LIST}.`;
    }

    return getSizeError(file, RACK_MAX_BYTES);
}

export { RACK_EXTENSION_LIST, RACK_MAX_BYTES, decodeRackFile, validateRackFile };
