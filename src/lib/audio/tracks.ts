import { MILLISECONDS_PER_SECOND, SIGNED_URL_SECONDS, STORAGE_BUCKETS, TRACK_LOAD_MESSAGE, TRACK_PLAY_TOPIC, TRACK_STATE_TOPIC } from '@lib/shared/constants';
import { announceTrackState, getPlayerState, getTrack, togglePlayback } from '@lib/audio/player';
import { registerPageScript } from '@lib/shared/utils';
import { supabase } from '@lib/shared/supabase';
import { toast } from '@lib/ui/toasts';

const TRACK_BUTTON_SELECTOR = 'button[data-track-id]';

const signedTracks = new Map<string, SignedTrack>();
const signingPaths = new Set<string>();

let isRegistered = false;
let pendingPath = '';

function dispatchTrack(track: PlayerTrack) {
    window.dispatchEvent(new CustomEvent(TRACK_PLAY_TOPIC, { detail: { track } }));
}

function handleTrackClick(button: HTMLButtonElement) {
    const isCurrent = getTrack()?.id === button.dataset.trackId;
    const path = button.dataset.trackPath;

    pendingPath = '';

    if (isCurrent && (!path || getPlayerState().playing)) {
        togglePlayback();

        return;
    }

    if (path) {
        void playStored(button, path);

        return;
    }

    dispatchTrack(readTrack(button));
}

function handleTrackState(event: CustomEvent<TrackState>, buttons: NodeListOf<HTMLButtonElement>) {
    const { playing, trackId } = event.detail;

    buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.trackId === trackId && playing));
    });
}

function initTracks(): void {
    if (isRegistered) return;

    isRegistered = true;
    registerPageScript(start, true);
}

async function playStored(button: HTMLButtonElement, path: string) {
    pendingPath = path;

    if (signingPaths.has(path)) return;

    signingPaths.add(path);

    const file = await signTrack(path);

    signingPaths.delete(path);

    if (pendingPath !== path) return;

    pendingPath = '';

    if (!file) {
        toast(TRACK_LOAD_MESSAGE, 'error');

        return;
    }

    if (getTrack()?.file === file) {
        togglePlayback();

        return;
    }

    dispatchTrack({ ...readTrack(button), file });
}

function readTrack(button: HTMLButtonElement) {
    const { trackArtist = '', trackDuration = '0', trackId = '', trackSeed = '', trackTitle = '' } = button.dataset;

    return { artist: trackArtist, durationSeconds: Number(trackDuration), id: trackId, seed: trackSeed, title: trackTitle };
}

async function signTrack(path: string) {
    const cached = signedTracks.get(path);

    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.tracks).createSignedUrl(path, SIGNED_URL_SECONDS);

    if (error) return null;

    signedTracks.set(path, { expiresAt: Date.now() + SIGNED_URL_SECONDS * MILLISECONDS_PER_SECOND, url: data.signedUrl });

    return data.signedUrl;
}

function start(signal: AbortSignal) {
    const buttons = document.querySelectorAll<HTMLButtonElement>(TRACK_BUTTON_SELECTOR);

    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', () => handleTrackClick(button), { signal });
    });

    window.addEventListener(TRACK_STATE_TOPIC, event => handleTrackState(event, buttons), { signal });
    announceTrackState();
}

export { initTracks };
