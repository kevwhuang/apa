import { TRACK_PLAY_TOPIC, TRACK_STATE_TOPIC } from '@lib/shared/constants';
import { announceTrackState, getTrack, togglePlayback } from '@lib/audio/player';
import { registerPageScript } from '@lib/shared/utils';

const TRACK_BUTTON_SELECTOR = 'button[data-track-id]';

let registered = false;

function handleTrackClick(button: HTMLButtonElement) {
    if (getTrack()?.id === button.dataset.trackId) {
        togglePlayback();

        return;
    }

    window.dispatchEvent(new CustomEvent(TRACK_PLAY_TOPIC, { detail: { track: readTrack(button) } }));
}

function handleTrackState(event: CustomEvent<TrackState>, buttons: NodeListOf<HTMLButtonElement>) {
    const { playing, trackId } = event.detail;

    buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(playing && button.dataset.trackId === trackId));
    });
}

function initTracks(): void {
    if (registered) return;

    registered = true;
    registerPageScript(start);
}

function readTrack(button: HTMLButtonElement) {
    const { trackArtist = '', trackDuration = '0', trackId = '', trackTitle = '' } = button.dataset;

    return { artist: trackArtist, durationSeconds: Number(trackDuration), id: trackId, title: trackTitle };
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
