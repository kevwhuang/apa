const ARMED_CLASS = 'is-motion-armed';
const CART_KEY = '__CART_KEY__';
const DARK_THEME_COLOR = '#171310';
const DEFAULT_THEME = 'light';
const LIGHT_THEME_COLOR = '#f6f1e4';
const ORDER_KEY = '__ORDER_KEY__';
const RECEIPT_FRESH_MILLISECONDS = 120_000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SESSION_KEY = '__SESSION_KEY__';
const THEME_COLOR_SELECTOR = 'meta[name="theme-color"]';
const THEME_KEY = '__THEME_KEY__';
const WATCHDOG_MILLISECONDS = 2_500;

const doc = globalThis.document;

const root = doc.documentElement;

function initCartState() {
    const rows = readCartRows();

    root.dataset.cart = readCartState();

    if (rows !== null) root.style.setProperty('--cart-rows', String(rows));

    doc.addEventListener('astro:before-swap', (event) => {
        const next = event.newDocument.documentElement;
        const nextRows = readCartRows();

        next.dataset.cart = readCartState();

        if (nextRows !== null) next.style.setProperty('--cart-rows', String(nextRows));
    });
}

function initMotionBridge() {
    if (globalThis.window.__apaMotion) return;

    const state = { arm, armedClass: ARMED_CLASS, disarm, expired: false, live };

    let watchdog = globalThis.setTimeout(expire, WATCHDOG_MILLISECONDS);

    function arm() {
        if (state.expired) return;
        if (globalThis.matchMedia(REDUCED_MOTION_QUERY).matches) return disarm();

        globalThis.clearTimeout(watchdog);
        root.classList.add(ARMED_CLASS);
        watchdog = globalThis.setTimeout(expire, WATCHDOG_MILLISECONDS);
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

    globalThis.window.__apaMotion = state;
    arm();
    doc.addEventListener('astro:after-swap', arm);

    doc.addEventListener('astro:before-swap', (event) => {
        if (globalThis.matchMedia(REDUCED_MOTION_QUERY).matches || state.expired) return;

        event.newDocument.documentElement.classList.add(ARMED_CLASS);
    });

    globalThis.addEventListener('beforeprint', disarm);
}

function initReceiptState() {
    root.dataset.receipt = readReceiptState();

    doc.addEventListener('astro:before-swap', (event) => {
        event.newDocument.documentElement.dataset.receipt = readReceiptState();
    });
}

function initScrollRestore() {
    let navigation = 'push';

    function scrollToAnchor() {
        const target = doc.getElementById(globalThis.location.hash.slice(1));

        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    function settle() {
        const state = globalThis.history.state;

        if (navigation !== 'traverse') return scrollToAnchor();

        if (state && typeof state.scrollY === 'number') globalThis.scrollTo({ behavior: 'instant', left: state.scrollX, top: state.scrollY });
    }

    doc.addEventListener('DOMContentLoaded', settle, { once: true });

    doc.addEventListener('astro:before-preparation', (event) => {
        navigation = event.navigationType;
    });

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
    let theme = DEFAULT_THEME;

    try {
        const raw = globalThis.localStorage.getItem(THEME_KEY);

        const stored = raw ? JSON.parse(raw) : null;

        if (stored === 'dark' || stored === 'light') theme = stored;
    } catch {
        theme = DEFAULT_THEME;
    }

    root.dataset.theme = theme;
    doc.querySelector(THEME_COLOR_SELECTOR)?.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);

    doc.addEventListener('astro:before-swap', (event) => {
        event.newDocument.documentElement.dataset.theme = root.dataset.theme;
    });
}

function readCartRows() {
    let rows = null;

    try {
        const raw = globalThis.localStorage.getItem(CART_KEY);

        const isSeedPending = raw === null;

        const items = isSeedPending ? [] : JSON.parse(raw);

        if (!isSeedPending) rows = Array.isArray(items) ? items.length : 0;
    } catch {
        rows = 0;
    }

    return rows;
}

function readCartState() {
    return readCartRows() === 0 ? 'empty' : 'filled';
}

function readReceiptState() {
    let state = 'stale';

    try {
        const raw = globalThis.localStorage.getItem(ORDER_KEY);

        const order = raw ? JSON.parse(raw) : null;

        if (order && Date.now() - Number(order.placedAt) < RECEIPT_FRESH_MILLISECONDS) state = 'fresh';
    } catch {
        state = 'stale';
    }

    return state;
}

initTheme();
initSessionState();
initCartState();
initReceiptState();
initMotionBridge();
initScrollRestore();
