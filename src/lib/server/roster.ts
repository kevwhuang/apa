import { STORAGE_BUCKETS } from '@lib/shared/constants';
import { createServerClient } from '@lib/server/supabase';
import { toAustinIso } from '@lib/shared/utils';

interface RosterRow {
    artist_name: string;
    avatar_path: string;
    bio: string;
    city: string;
    created_at: string;
    featured: boolean;
    genres: string[];
    instagram_url: string;
    member_number: number;
    role: MemberRole;
    soundcloud_url: string;
    spotify_url: string;
    state: string;
    track_name: string;
    track_path: string;
    track_seconds: number;
    youtube_url: string;
}

const ID_DIGITS = 6;
const TRACK_EXTENSION_PATTERN = /\.(mp3|wav)$/i;

async function loadRoster(): Promise<RosterMember[] | null> {
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('get_roster');

    if (error) return null;

    const avatars = supabase.storage.from(STORAGE_BUCKETS.avatars);
    const rows: RosterRow[] = data ?? [];

    return rows.map(row => toRosterMember(row, row.avatar_path ? avatars.getPublicUrl(row.avatar_path).data.publicUrl : ''));
}

function toRosterMember(row: RosterRow, portrait: string) {
    const links = [
        { href: row.instagram_url, label: 'Instagram' },
        { href: row.spotify_url, label: 'Spotify' },
        { href: row.soundcloud_url, label: 'SoundCloud' },
        { href: row.youtube_url, label: 'YouTube' },
    ];

    const track = {
        durationSeconds: row.track_seconds,
        path: row.track_path,
        title: row.track_name.replace(TRACK_EXTENSION_PATTERN, '').replaceAll('_', ' '),
    };

    return {
        bio: row.bio,
        featured: row.featured,
        genres: row.genres,
        id: String(row.member_number).padStart(ID_DIGITS, '0'),
        joined: toAustinIso(new Date(row.created_at)),
        links: links.filter(link => link.href),
        location: [row.city, row.state].filter(Boolean).join(', '),
        name: row.artist_name,
        portrait,
        roles: [row.role],
        tracks: row.track_name ? [track] : [],
    };
}

export { loadRoster };
