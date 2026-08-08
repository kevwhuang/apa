import { AVATAR } from '@lib/shared/constants';
import { formatExtensions, getExtension, getSizeError } from '@lib/audio/uploads';

const AVATAR_EXTENSIONS = [...AVATAR.extensions, ...AVATAR.aliasExtensions];
const AVATAR_EXTENSIONS_OR_LIST = formatExtensions(AVATAR.extensions);

async function decodeImage(file: File) {
    if (typeof createImageBitmap === 'undefined') return null;

    try {
        return await createImageBitmap(file);
    } catch {
        return null;
    }
}

function normalizeAvatar(value: string): string {
    return value.startsWith('data:image/') && value.length <= AVATAR.maxDataUrlLength ? value : '';
}

function rejectionReason(file: File) {
    const extension = getExtension(file.name);

    if (!AVATAR_EXTENSIONS.some(allowed => allowed === extension)) {
        return `That is a .${extension || 'file'} \u2014 we take ${AVATAR_EXTENSIONS_OR_LIST}.`;
    }

    if (file.type.length > 0 && !file.type.startsWith('image/') && !AVATAR.acceptAttribute.includes(file.type)) {
        return 'That does not look like an image file.';
    }

    return getSizeError(file, AVATAR.maxFileBytes) ?? '';
}

function renderAvatar(image: ImageBitmap) {
    const canvas = document.createElement('canvas');

    const context = canvas.getContext('2d');
    const edge = Math.min(image.height, image.width);

    if (!context) return '';

    canvas.height = AVATAR.renderPixels;
    canvas.width = AVATAR.renderPixels;
    context.drawImage(image, (image.width - edge) / 2, (image.height - edge) / 2, edge, edge, 0, 0, AVATAR.renderPixels, AVATAR.renderPixels);

    const rendered = canvas.toDataURL(AVATAR.renderType, AVATAR.renderQuality);

    return rendered.startsWith(`data:${AVATAR.renderType}`) ? rendered : canvas.toDataURL(AVATAR.fallbackType, AVATAR.renderQuality);
}

async function stageAvatar(file: File): Promise<AvatarResult> {
    const rejection = rejectionReason(file);

    if (rejection) return { message: rejection, ok: false };

    const image = await decodeImage(file);

    if (!image) return { message: 'That image could not be read.', ok: false };

    const { height, width } = image;

    if (Math.min(height, width) < AVATAR.minEdgePixels) {
        image.close();

        return { message: `That image is ${width}\u00d7${height} \u2014 it needs at least ${AVATAR.minEdgePixels}px on each side.`, ok: false };
    }

    const dataUrl = renderAvatar(image);

    image.close();

    if (dataUrl.length === 0 || dataUrl.length > AVATAR.maxDataUrlLength) {
        return { message: 'That image could not be processed. Try a smaller one.', ok: false };
    }

    return { dataUrl, ok: true };
}

export { AVATAR_EXTENSIONS_OR_LIST, normalizeAvatar, stageAvatar };
