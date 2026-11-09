interface AssemblyDemo {
    producer: string;
    source: string;
    submittedAt: string;
}

const ASSEMBLY_DEMOS: AssemblyDemo[] = [
    { producer: 'Mara Vance', source: 'soundcloud.com/mara-vance/night-bus-sketch', submittedAt: '2026-10-08T17:04:00-05:00' },
    { producer: 'Elijah Brandt', source: 'low_tide_rough.wav', submittedAt: '2026-10-08T17:09:00-05:00' },
    { producer: 'Rosa Quintero', source: 'open.spotify.com/track/5mQ2vTc8yL1nW4pR7sXd0B', submittedAt: '2026-10-08T17:13:00-05:00' },
    { producer: 'Tobias Achterberg', source: 'porch_light_v3.mp3', submittedAt: '2026-10-08T17:16:00-05:00' },
    { producer: 'Kit Oduya', source: 'soundcloud.com/kit-oduya/eastside-swing', submittedAt: '2026-10-08T17:20:00-05:00' },
    { producer: 'Imani Castellanos-Whitfield', source: 'second_verse_needs_work_bounce_2026_10_07_master_attempt.wav', submittedAt: '2026-10-08T17:24:00-05:00' },
    { producer: 'Hal Nyberg', source: 'soundcloud.com/hal-nyberg/brass-loop-idea', submittedAt: '2026-10-08T17:27:00-05:00' },
    { producer: 'Selene Okoro', source: 'quiet_engine.wav', submittedAt: '2026-10-08T17:31:00-05:00' },
    { producer: 'Dario Pell', source: 'open.spotify.com/track/2hX9cKe4uVb6ZoQ3tN8fLa', submittedAt: '2026-10-08T17:34:00-05:00' },
    { producer: 'Greta Lindqvist', source: 'mesquite_smoke.mp3', submittedAt: '2026-10-08T17:38:00-05:00' },
    { producer: 'August Reyes', source: 'soundcloud.com/august-reyes/flatbed', submittedAt: '2026-10-08T17:41:00-05:00' },
    { producer: 'Noor Haddad', source: 'drum_bus_test_02.wav', submittedAt: '2026-10-08T17:45:00-05:00' },
    { producer: 'Wren Calder', source: 'soundcloud.com/wren-calder/under-the-overpass-extended-rough-mix-for-feedback', submittedAt: '2026-10-08T17:48:00-05:00' },
    { producer: 'Benji Saldana', source: 'cassette_choir.mp3', submittedAt: '2026-10-08T17:52:00-05:00' },
    { producer: 'Leona Fitch', source: 'open.spotify.com/track/7rTq1eWm0aZc5nH2gYk4Ps', submittedAt: '2026-10-08T17:55:00-05:00' },
    { producer: 'Omar Bellweather', source: 'red_line_home.wav', submittedAt: '2026-10-08T17:58:00-05:00' },
    { producer: 'Pia Moreau', source: 'soundcloud.com/pia-moreau/glass-garden', submittedAt: '2026-10-08T18:02:00-05:00' },
    { producer: 'Jonah Whitcomb', source: 'heat_haze_v5.mp3', submittedAt: '2026-10-08T18:06:00-05:00' },
    { producer: 'Tess Arroyo', source: 'soundcloud.com/tess-arroyo/slow-burn-edit', submittedAt: '2026-10-08T18:09:00-05:00' },
    { producer: 'Felipe Manzano', source: 'chord_study_four.wav', submittedAt: '2026-10-08T18:13:00-05:00' },
    { producer: 'Ivy Holloway', source: 'open.spotify.com/track/3bNf8uJx2pLq6WdC9vRe1T', submittedAt: '2026-10-08T18:17:00-05:00' },
    { producer: 'Malik Prentiss', source: 'sidechain_sermon.mp3', submittedAt: '2026-10-08T18:20:00-05:00' },
    { producer: 'Oona Bright', source: 'soundcloud.com/oona-bright/county-line', submittedAt: '2026-10-08T18:24:00-05:00' },
    { producer: 'Sami Varga', source: 'last_call_sketch.wav', submittedAt: '2026-10-08T18:27:00-05:00' },
];

const KNOWN_HOSTS = [
    { label: 'SoundCloud', pattern: /(^|\.)(snd\.sc|soundcloud\.com)$/ },
    { label: 'Spotify', pattern: /(^|\.)(spotify\.com|spotify\.link)$/ },
] as const;

function parseTrackLink(raw: string): TrackLinkResult {
    const value = raw.trim();

    if (value.length === 0) return { message: 'Paste a link first.', ok: false };

    const url = toUrl(value);

    if (!url) return { message: 'That does not read as a link.', ok: false };

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { message: 'Links need to start with http or https.', ok: false };
    }

    const known = KNOWN_HOSTS.find(host => host.pattern.test(url.hostname));

    if (!known) return { message: 'That is not a SoundCloud or Spotify link.', ok: false };

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

export { ASSEMBLY_DEMOS, parseTrackLink };
