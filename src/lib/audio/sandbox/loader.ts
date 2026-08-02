import { UPLOAD } from '@lib/constants';
import { UPLOAD_EXTENSIONS_OR_LIST, getExtension, getSizeError } from '@lib/uploads';
import { ensureSandboxAudio } from '@lib/audio/sandbox/context';

const ABORTED_MESSAGE = 'The sandbox closed before that file finished.';

export const SANDBOX_EXTENSION_LIST = UPLOAD_EXTENSIONS_OR_LIST;

export const SANDBOX_MAX_BYTES = UPLOAD.maxDecodeBytes;

export async function loadSandboxFile(file: File, signal?: AbortSignal): Promise<SandboxLoadResult> {
    const invalid = validateSandboxFile(file);

    if (invalid) return { message: invalid, ok: false };

    try {
        const bytes = await file.arrayBuffer();

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        const { context } = ensureSandboxAudio();
        const buffer = await context.decodeAudioData(bytes);

        if (signal?.aborted) return { message: ABORTED_MESSAGE, ok: false };

        return { buffer, ok: true };
    } catch {
        return { message: 'That file could not be decoded.', ok: false };
    }
}

export function validateSandboxFile(file: File): string | undefined {
    const extension = getExtension(file.name);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'} \u2014 we take ${SANDBOX_EXTENSION_LIST}.`;
    }

    return getSizeError(file, SANDBOX_MAX_BYTES);
}
