const ARMED_CLASS = 'is-motion-armed';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCE = '(prefers-reduced-motion: reduce)';
const SESSION_KEY = '__SESSION_KEY__';
const THEME_KEY = '__THEME_KEY__';
const WATCHDOG_MS = 2_500;

const doc = globalThis.document;
const root = doc.documentElement;

function initMotionBridge() {
    if (globalThis.__apaMotion) return;

    const state = { arm, armedClass: ARMED_CLASS, disarm, expired: false, live };

    let watchdog;

    function arm() {
        if (state.expired) return;
        if (globalThis.matchMedia(REDUCE).matches) return disarm();

        root.classList.add(ARMED_CLASS);
        globalThis.clearTimeout(watchdog);
        watchdog = globalThis.setTimeout(expire, WATCHDOG_MS);
    }

    function disarm() {
        globalThis.clearTimeout(watchdog);
        root.classList.remove(ARMED_CLASS);
    }

    function expire() {
        state.expired = true;
        disarm();
    }

    function live() {
        globalThis.clearTimeout(watchdog);

        return !state.expired;
    }

    function preArm(event) {
        if (state.expired || globalThis.matchMedia(REDUCE).matches) return;

        event.newDocument.documentElement.classList.add(ARMED_CLASS);
    }

    globalThis.__apaMotion = state;
    arm();
    doc.addEventListener('astro:after-swap', arm);
    doc.addEventListener('astro:before-swap', preArm);
    globalThis.addEventListener('beforeprint', disarm);
}

function initScrollRestore() {
    let navigation = 'push';

    function anchor() {
        const target = doc.getElementById(globalThis.location.hash.slice(1));

        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    function settle() {
        const state = globalThis.history.state;

        if (navigation !== 'traverse') return anchor();
        if (state && typeof state.scrollY === 'number') globalThis.scrollTo({ behavior: 'instant', left: state.scrollX, top: state.scrollY });
    }

    function track(event) {
        navigation = event.navigationType;
    }

    doc.addEventListener('DOMContentLoaded', settle, { once: true });
    doc.addEventListener('astro:before-preparation', track);
    doc.addEventListener('astro:page-load', settle);
}

function initSessionState() {
    let state = 'out';

    try {
        const raw = globalThis.localStorage.getItem(SESSION_KEY);
        const session = raw ? JSON.parse(raw) : null;

        if (session && session.expiresAt > Date.now()) state = 'in';
    } catch {
        state = 'out';
    }

    root.dataset.session = state;
}

function initTheme() {
    let theme;

    function preferred() {
        return globalThis.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
    }

    function preStamp(event) {
        event.newDocument.documentElement.dataset.theme = root.dataset.theme;
    }

    try {
        const raw = globalThis.localStorage.getItem(THEME_KEY);
        const stored = raw ? JSON.parse(raw) : null;

        theme = stored === 'dark' || stored === 'light' ? stored : preferred();
    } catch {
        theme = preferred();
    }

    root.dataset.theme = theme;
    doc.addEventListener('astro:before-swap', preStamp);
}

initTheme();
initSessionState();
initMotionBridge();
initScrollRestore();
