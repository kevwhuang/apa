const KNOWN_HOSTS = [
    { label: 'Audius', pattern: /(^|\.)audius\.co$/ },
    { label: 'Dropbox', pattern: /(^|\.)dropbox\.com$/ },
    { label: 'Google Drive', pattern: /(^|\.)(docs|drive)\.google\.com$/ },
    { label: 'OneDrive', pattern: /(^|\.)(1drv\.ms|onedrive\.live\.com)$/ },
    { label: 'SoundCloud', pattern: /(^|\.)(snd\.sc|soundcloud\.com)$/ },
    { label: 'WeTransfer', pattern: /(^|\.)(we\.tl|wetransfer\.com)$/ },
    { label: 'YouTube', pattern: /(^|\.)(youtu\.be|youtube\.com)$/ },
] as const;

function describeHost(hostname: string): string {
    const bare = hostname.replace(/^www\./, '');

    const known = KNOWN_HOSTS.find(host => host.pattern.test(bare));

    return known ? known.label : bare;
}

function parseTrackLink(raw: string): TrackLinkResult {
    const value = raw.trim();

    if (value.length === 0) return { message: 'Paste a link first.', ok: false };

    const url = toUrl(value);

    if (!url) return { message: 'That does not read as a link.', ok: false };

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { message: 'Links need to start with http or https.', ok: false };
    }

    if (!url.hostname.includes('.')) return { message: 'That does not read as a link.', ok: false };

    return { link: { host: describeHost(url.hostname), href: url.href, id: crypto.randomUUID() }, ok: true };
}

function toUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        if (value.includes('://') || value.includes(' ')) return null;

        try {
            return new URL(`https://${value}`);
        } catch {
            return null;
        }
    }
}

export { parseTrackLink };
