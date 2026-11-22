const KNOWN_HOSTS = [
    { label: 'SoundCloud', pattern: /(^|\.)(snd\.sc|soundcloud\.com)$/ },
    { label: 'Spotify', pattern: /(^|\.)(spotify\.com|spotify\.link)$/ },
] as const;

function parseTrackLink(raw: string): TrackLinkResult {
    const value = raw.trim();

    if (value.length === 0) return { message: 'Paste a link first.', ok: false };

    const url = toUrl(value);

    if (!url) return { message: 'That does not read as a link.', ok: false };
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { message: 'Links need to start with http or https.', ok: false };

    const known = KNOWN_HOSTS.find(host => host.pattern.test(url.hostname));

    if (!known || url.username || url.password || url.port) return { message: 'That is not a Spotify or SoundCloud link.', ok: false };

    if (url.pathname.replace(/\/+$/, '').length === 0) return { message: 'That link does not point to a track.', ok: false };

    url.hash = '';
    url.hostname = url.hostname.replace(/^(m|www)\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.protocol = 'https:';
    url.search = '';

    return { link: { host: known.label, href: url.href, id: crypto.randomUUID() }, ok: true };
}

function toUrl(value: string) {
    try {
        return new URL(value);
    } catch {
        if (value.includes(' ') || value.includes('://')) return null;

        try {
            return new URL(`https://${value}`);
        } catch {
            return null;
        }
    }
}

export { parseTrackLink };
