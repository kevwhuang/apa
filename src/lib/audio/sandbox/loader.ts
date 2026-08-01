import { UPLOAD } from '@lib/constants';
import { ensureSandboxAudio } from '@lib/audio/sandbox/context';
import { formatBytes } from '@lib/utils';

export type SandboxLoadResult = { buffer: AudioBuffer; ok: true } | { message: string; ok: false };

const ABORTED_MESSAGE = 'The sandbox closed before that file finished.';

export const SANDBOX_EXTENSION_LIST = formatExtensions(UPLOAD.extensions);

export const SANDBOX_MAX_BYTES = UPLOAD.maxDecodeBytes;

function extensionOf(name: string) {
    const index = name.lastIndexOf('.');

    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
}

function formatExtensions(extensions: readonly string[]) {
    const names = extensions
        .filter(extension => !extensions.some(other => other !== extension && other.startsWith(extension)))
        .map(extension => extension.toUpperCase());
    const last = names.pop() ?? '';

    return names.length > 0 ? `${names.join(', ')} or ${last}` : last;
}

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
    const extension = extensionOf(file.name);

    if (!UPLOAD.extensions.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'} \u2014 we take ${SANDBOX_EXTENSION_LIST}.`;
    }

    if (file.size === 0) return 'That file is empty.';

    if (file.size > SANDBOX_MAX_BYTES) {
        return `That file is ${formatBytes(file.size)} \u2014 the limit is ${formatBytes(SANDBOX_MAX_BYTES)}.`;
    }

    return undefined;
}
