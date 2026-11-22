import { AVATAR, STATUS_SERVER_ERROR, STORAGE_BUCKETS } from '@lib/shared/constants';
import { formatExtensions, getExtension, getSizeError } from '@lib/audio/uploads';
import { supabase } from '@lib/shared/supabase';

type AvatarUpload = { isRefused: boolean; ok: false } | { ok: true; path: string };

const AVATAR_EXTENSIONS = [...AVATAR.extensions, ...AVATAR.aliasExtensions];
const DATA_URL_PATTERN = /^data:(image\/[a-z]+);base64,(.+)$/;
const FOLDER_LIST_LIMIT = 10;
const STATUS_CLIENT_ERROR = 400;

const UPLOAD_EXTENSIONS: Partial<Record<string, string>> = {
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

const avatarExtensionsOrList = formatExtensions(AVATAR.extensions);
const avatarPrefix = supabase.storage.from(STORAGE_BUCKETS.avatars).getPublicUrl('').data.publicUrl;

function decodeDataUrl(dataUrl: string) {
    const match = DATA_URL_PATTERN.exec(dataUrl);

    if (!match) return null;

    try {
        const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));

        return new Blob([bytes], { type: match[1] });
    } catch {
        return null;
    }
}

async function decodeImage(file: File) {
    if (typeof createImageBitmap === 'undefined') return null;

    try {
        return await createImageBitmap(file);
    } catch {
        return null;
    }
}

function getAvatarUrl(path: string): string {
    return path ? supabase.storage.from(STORAGE_BUCKETS.avatars).getPublicUrl(path).data.publicUrl : '';
}

function getRejectionReason(file: File) {
    const extension = getExtension(file.name);

    if (!AVATAR_EXTENSIONS.some(allowed => allowed === extension)) return `That is a .${extension || 'file'}. We take ${avatarExtensionsOrList}.`;

    if (!AVATAR.acceptAttribute.includes(file.type) && !file.type.startsWith('image/') && file.type.length > 0) {
        return 'That does not look like an image file.';
    }

    return getSizeError(file, AVATAR.maxFileBytes) ?? '';
}

function normalizeAvatar(value: string): string {
    if (value.length > avatarPrefix.length && value.startsWith(avatarPrefix)) return value;

    return value.length <= AVATAR.maxDataUrlLength && value.startsWith('data:image/') ? value : '';
}

async function removeAvatar(path: string): Promise<void> {
    if (!path) return;

    await supabase.storage.from(STORAGE_BUCKETS.avatars).remove([path]);
}

function renderAvatar(image: ImageBitmap) {
    const canvas = document.createElement('canvas');
    const edge = Math.min(image.height, image.width);

    const context = canvas.getContext('2d');

    if (!context) return '';

    canvas.height = AVATAR.renderPixels;
    canvas.width = AVATAR.renderPixels;
    context.drawImage(image, (image.width - edge) / 2, (image.height - edge) / 2, edge, edge, 0, 0, AVATAR.renderPixels, AVATAR.renderPixels);

    const rendered = canvas.toDataURL(AVATAR.renderType, AVATAR.renderQuality);

    return rendered.startsWith(`data:${AVATAR.renderType}`) ? rendered : canvas.toDataURL(AVATAR.fallbackType, AVATAR.renderQuality);
}

async function stageAvatar(file: File): Promise<AvatarResult> {
    const rejection = getRejectionReason(file);

    if (rejection) return { message: rejection, ok: false };

    const image = await decodeImage(file);

    if (!image) return { message: 'That image could not be read.', ok: false };

    const { height, width } = image;

    if (Math.min(height, width) < AVATAR.minEdgePixels) {
        image.close();

        return { message: `That image is ${width}\u00d7${height}. It needs at least ${AVATAR.minEdgePixels}px on each side.`, ok: false };
    }

    const dataUrl = renderAvatar(image);

    image.close();

    if (dataUrl.length === 0 || dataUrl.length > AVATAR.maxDataUrlLength) {
        return { message: 'That image could not be processed. Try a smaller one.', ok: false };
    }

    return { dataUrl, ok: true };
}

function toAvatarPath(url: string): string {
    return url.startsWith(avatarPrefix) ? url.slice(avatarPrefix.length) : '';
}

async function uploadAvatar(userId: string, dataUrl: string, currentPath: string): Promise<AvatarUpload> {
    const blob = decodeDataUrl(dataUrl);
    const bucket = supabase.storage.from(STORAGE_BUCKETS.avatars);

    const extension = UPLOAD_EXTENSIONS[blob?.type ?? ''];

    if (!blob || !extension) return { isRefused: true, ok: false };

    const path = `${userId}/${crypto.randomUUID()}.${extension}`;

    const { data: objects } = await bucket.list(userId, { limit: FOLDER_LIST_LIMIT });

    const strays = (objects ?? [])
        .map(object => `${userId}/${object.name}`)
        .filter(stray => stray !== currentPath);

    if (strays.length > 0) await bucket.remove(strays);

    const { error } = await bucket.upload(path, blob);

    if (!error) return { ok: true, path };

    const status = error.status ?? 0;

    return { isRefused: status >= STATUS_CLIENT_ERROR && status < STATUS_SERVER_ERROR, ok: false };
}

export { avatarExtensionsOrList, getAvatarUrl, normalizeAvatar, removeAvatar, stageAvatar, toAvatarPath, uploadAvatar };
