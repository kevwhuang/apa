import { BYTES_PER_MEGABYTE, DECODE_FAILED_MESSAGE } from '@lib/shared/constants';
import { ensureRackAudio } from '@lib/rack/context';
import { getExtensionError, getFormatError, getSizeError } from '@lib/audio/uploads';

const RACK_MAX_MEGABYTES = 100;

const rackMaxBytes = RACK_MAX_MEGABYTES * BYTES_PER_MEGABYTE;

async function decodeRackFile(file: File): Promise<RackLoadResult> {
    const error = validateRackFile(file);

    if (error) return { message: error, ok: false };

    try {
        const bytes = await file.arrayBuffer();

        const formatError = getFormatError(file, bytes);

        if (formatError) return { message: formatError, ok: false };

        const { context } = ensureRackAudio();

        const buffer = await context.decodeAudioData(bytes);

        return { buffer, ok: true };
    } catch {
        return { message: DECODE_FAILED_MESSAGE, ok: false };
    }
}

function validateRackFile(file: File): string | undefined {
    return getExtensionError(file.name) ?? getSizeError(file, rackMaxBytes);
}

export { decodeRackFile, rackMaxBytes, validateRackFile };
