import { BOARD_PAGE_SIZE, describeBoard, getBoard, onBoardChange, signSubmission, watchBoard } from '@lib/programs/submissions';
import { TRACK_PLAY_TOPIC, TRACK_STATE_TOPIC } from '@lib/shared/constants';
import { announceTrackState, getTrack, togglePlayback } from '@lib/audio/player';
import { applyInstantly, formatEntry, formatTime, initRovingFocus, setHidden, setText, toAustinIso } from '@lib/shared/utils';
import { getSession, onSessionChange } from '@lib/account/session';
import { toast } from '@lib/ui/toasts';

interface BoardElements {
    body: HTMLElement;
    chipTemplate: HTMLTemplateElement;
    fillerTemplate: HTMLTemplateElement;
    frame: HTMLElement;
    linkTemplate: HTMLTemplateElement | null;
    pager: HTMLElement;
    playTemplate: HTMLTemplateElement | null;
    refresh: HTMLElement;
    refreshText: HTMLElement;
    root: HTMLElement;
    rowTemplate: HTMLTemplateElement;
    status: HTMLElement;
}

interface BoardOptions {
    board: IntakeBoard;
    signal: AbortSignal;
    sourceSelector: string;
}

const BOARD_SHARE_MAX = 0.75;
const BOARD_SHARE_MIN = 0.25;
const LOAD_MESSAGE = 'The board could not be loaded. Reload the page to try again.';
const PLAY_MESSAGE = 'That track could not be loaded. Try again.';

function createBoard(options: BoardOptions): void {
    const body = document.querySelector<HTMLElement>('[data-board-body]');
    const chipTemplate = document.querySelector<HTMLTemplateElement>('[data-board-page]');
    const fillerTemplate = document.querySelector<HTMLTemplateElement>('[data-board-filler]');
    const frame = document.querySelector<HTMLElement>('[data-board-frame]');
    const linkTemplate = document.querySelector<HTMLTemplateElement>('[data-board-link]');
    const pager = document.querySelector<HTMLElement>('[data-board-pager]');
    const playTemplate = document.querySelector<HTMLTemplateElement>('[data-board-play]');
    const refresh = document.querySelector<HTMLElement>('[data-board-refresh]');
    const refreshText = document.querySelector<HTMLElement>('[data-board-refresh-text]');
    const root = document.querySelector<HTMLElement>('[data-board-root]');
    const rowTemplate = document.querySelector<HTMLTemplateElement>('[data-board-row]');
    const status = document.querySelector<HTMLElement>('[data-board-status]');

    if (!body || !chipTemplate || !fillerTemplate || !frame || !pager || !refresh || !refreshText || !root || !rowTemplate || !status) return;
    if (!rowTemplate.content.querySelector(options.sourceSelector)) return;

    startBoard({
        body,
        chipTemplate,
        fillerTemplate,
        frame,
        linkTemplate,
        pager,
        playTemplate,
        refresh,
        refreshText,
        root,
        rowTemplate,
        status,
    }, options);
}

function createLink(entry: BoardEntry, template: HTMLTemplateElement) {
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    const anchor = fragment.querySelector('a');

    if (!anchor) return null;

    anchor.href = entry.href;
    setText(anchor.querySelector('[data-board-link-label]'), entry.source);

    return fragment;
}

function createPlay(entry: BoardEntry, template: HTMLTemplateElement) {
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    const button = fragment.querySelector('button');

    if (!button) return null;

    button.dataset.boardPlayId = entry.id;
    setText(button.querySelector('[data-board-play-label]'), entry.source);

    return fragment;
}

function fillCells(row: HTMLElement, selector: string, value: string) {
    row.querySelectorAll<HTMLElement>(selector).forEach((cell) => {
        cell.textContent = value;
        cell.title = value;
    });
}

function measureWidest(element: Element, values: string[]) {
    const context = document.createElement('canvas').getContext('2d');

    if (!context) return 0;

    const { fontFamily, fontSize, fontStyle, fontWeight } = getComputedStyle(element);

    context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;

    return values.reduce((widest, value) => Math.max(widest, context.measureText(value).width), 0);
}

function startBoard(elements: BoardElements, options: BoardOptions) {
    const { board, signal, sourceSelector } = options;
    const { body, chipTemplate, fillerTemplate, frame, linkTemplate, pager, playTemplate, refresh, refreshText, root, rowTemplate, status } = elements;

    let hasWarned = false;
    let isSigning = false;
    let page = 1;
    let pageCount = 0;
    let trackState: TrackState = { playing: false, trackId: '' };

    function buildPager() {
        pager.replaceChildren();

        for (let index = 1; index <= pageCount; index++) {
            const fragment = chipTemplate.content.cloneNode(true) as DocumentFragment;

            const chip = fragment.querySelector('button');

            if (!chip) continue;

            chip.addEventListener('click', () => setPage(index), { signal });
            chip.setAttribute('aria-label', `Page ${index}`);
            chip.textContent = String(index);
            pager.append(fragment);
        }

        initRovingFocus(pager.querySelectorAll('button'), signal);
    }

    function createControl(entry: BoardEntry) {
        if (entry.href && linkTemplate) return createLink(entry, linkTemplate);
        if (entry.path && playTemplate && getSession()?.admin) return createPlay(entry, playTemplate);

        return null;
    }

    function fillSource(row: HTMLElement, entry: BoardEntry) {
        fillCells(row, sourceSelector, entry.source);

        row.querySelectorAll<HTMLElement>(sourceSelector).forEach((cell) => {
            const control = createControl(entry);

            if (control) cell.replaceChildren(control);
        });
    }

    function handleBodyClick(event: MouseEvent) {
        const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-board-play-id]') : null;

        const entry = getBoard(board).entries.find(item => item.id === button?.dataset.boardPlayId);

        if (entry) void handlePlay(entry);
    }

    async function handlePlay(entry: BoardEntry) {
        if (isSigning) return;

        isSigning = true;

        const url = await signSubmission(entry);

        isSigning = false;

        if (!url) {
            toast(PLAY_MESSAGE, 'error');

            return;
        }

        const track = getTrack();

        if (track?.id === entry.id && track.file === url) {
            togglePlayback();

            return;
        }

        const next: PlayerTrack = { artist: entry.producer, durationSeconds: 0, file: url, id: entry.id, seed: entry.id, title: entry.source };

        window.dispatchEvent(new CustomEvent(TRACK_PLAY_TOPIC, { detail: { track: next } }));
    }

    function handleSessionChange() {
        watchBoard(board);
        render();
    }

    function handleTrackState(event: CustomEvent<TrackState>) {
        trackState = event.detail;
        syncPressed();
    }

    function render() {
        const state = getBoard(board);

        const isLoading = state.status === 'loading';
        const total = state.entries.length;

        setHidden(refresh, !isLoading);
        setText(refreshText, isLoading ? 'Loading\u2026' : '');

        if (isLoading && total === 0) return;

        if (state.status === 'failed' && total === 0 && !hasWarned && getSession()) {
            hasWarned = true;
            toast(LOAD_MESSAGE, 'error');
        }

        const pages = Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));

        page = Math.min(page, pages);
        setHidden(pager, total <= BOARD_PAGE_SIZE);
        setHidden(root, total === 0);

        if (pages !== pageCount) {
            pageCount = pages;
            buildPager();
        }

        renderRows(state.entries);
        updatePager();

        const message = describeBoard(page, total);

        if (status.textContent !== message) setText(status, message);

        syncPressed();
        void sizeColumns(state.entries);
    }

    function renderRows(entries: BoardEntry[]) {
        const start = (page - 1) * BOARD_PAGE_SIZE;

        const visible = entries.slice(start, start + BOARD_PAGE_SIZE);

        body.replaceChildren();

        if (visible.length === 0) return;

        visible.forEach((entry, index) => {
            const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment;

            const row = fragment.querySelector('tr');

            if (!row) return;

            const date = new Date(entry.submittedAt);
            const stamp = document.createElement('time');

            stamp.dateTime = toAustinIso(date);
            stamp.textContent = formatTime(date);
            setText(row.querySelector('[data-cell-index]'), formatEntry(start + index + 1));
            fillCells(row, '[data-cell-producer]', entry.producer);
            fillSource(row, entry);
            row.querySelector('[data-cell-submitted]')?.append(stamp);
            body.append(fragment);
        });

        for (let index = visible.length; index < BOARD_PAGE_SIZE; index++) {
            body.append(fillerTemplate.content.cloneNode(true));
        }
    }

    function setPage(next: number) {
        if (next === page) return;

        page = next;
        render();
    }

    async function sizeColumns(entries: BoardEntry[]) {
        frame.style.setProperty('--board-digits', String(formatEntry(entries.length).length));

        await document.fonts.ready;

        const producer = body.querySelector('[data-cell-producer]');
        const source = body.querySelector(`td${sourceSelector}`);

        if (signal.aborted || !producer || !source) return;

        const producerWidth = measureWidest(producer, entries.map(entry => entry.producer));
        const sourceWidth = measureWidest(source, entries.map(entry => entry.source));

        const share = Math.min(BOARD_SHARE_MAX, Math.max(BOARD_SHARE_MIN, producerWidth / (producerWidth + sourceWidth)));

        if (producerWidth + sourceWidth > 0) frame.style.setProperty('--board-share', String(share));
    }

    function syncPressed() {
        body.querySelectorAll<HTMLButtonElement>('[data-board-play-id]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.boardPlayId === trackState.trackId && trackState.playing));
        });
    }

    function updatePager() {
        pager.querySelectorAll('button').forEach((chip, index) => {
            const isActive = index + 1 === page;

            if (chip.classList.contains('is-active') === isActive) return;

            applyInstantly(chip, () => {
                chip.classList.toggle('is-active', isActive);

                if (isActive) chip.setAttribute('aria-current', 'page');
                else chip.removeAttribute('aria-current');
            });
        });
    }

    watchBoard(board);
    render();
    body.addEventListener('click', handleBodyClick, { signal });
    window.addEventListener(TRACK_STATE_TOPIC, handleTrackState, { signal });
    signal.addEventListener('abort', onBoardChange(render), { once: true });
    signal.addEventListener('abort', onSessionChange(handleSessionChange), { once: true });
    announceTrackState();
}

export { createBoard };
