const ARMED_CLASS = 'is-motion-armed';
const CART_KEY = '__CART_KEY__';
const DARK_THEME_COLOR = '#171310';
const DEFAULT_THEME = 'light';
const LIGHT_THEME_COLOR = '#f6f1e4';
const ONBOARDING_KEY = '__ONBOARDING_KEY__';
const ORDER_KEY = '__ORDER_KEY__';
const RECEIPT_FRESH_MILLISECONDS = 120_000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SEED_MARKER_KEY = 'apa.cart-seeded';
const SESSION_KEY = '__SESSION_KEY__';
const THEME_COLOR_SELECTOR = 'meta[name="theme-color"]';
const THEME_KEY = '__THEME_KEY__';
const WATCHDOG_MILLISECONDS = 2_500;

const doc = globalThis.document;

const root = doc.documentElement;

function hasOnboardingProgress() {
    try {
        const rawProgress = globalThis.localStorage.getItem(ONBOARDING_KEY);
        const rawSession = globalThis.localStorage.getItem(SESSION_KEY);

        const progress = rawProgress ? JSON.parse(rawProgress) : null;
        const session = rawSession ? JSON.parse(rawSession) : null;

        if (session?.onboarded === true) return false;

        return typeof session?.id === 'string' && session.id.length > 0 && progress?.userId === session.id && Number(progress.step) > 0;
    } catch {
        return false;
    }
}

function initCartState() {
    root.dataset.cart = readCartState();
    root.style.setProperty('--cart-rows', String(readCartRows()));

    doc.addEventListener('astro:before-swap', (event) => {
        const next = event.newDocument.documentElement;

        next.dataset.cart = readCartState();
        next.style.setProperty('--cart-rows', String(readCartRows()));
    });
}

function initMotionBridge() {
    if (globalThis.window.__apaMotion) return;

    const state = { arm, disarm, expired: false, live };

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

function initOnboardingState() {
    root.toggleAttribute('data-onboarding-resume', hasOnboardingProgress());

    doc.addEventListener('astro:before-swap', (event) => {
        event.newDocument.documentElement.toggleAttribute('data-onboarding-resume', hasOnboardingProgress());
    });
}

function initReceiptState() {
    root.dataset.receipt = readReceiptState();

    doc.addEventListener('astro:before-swap', (event) => {
        event.newDocument.documentElement.dataset.receipt = readReceiptState();
    });
}

function initScrollRestore() {
    let navigation = 'push';

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
    let admin = 'false';
    let onboarded = 'false';
    let state = 'out';

    try {
        const raw = globalThis.localStorage.getItem(SESSION_KEY);

        const session = raw ? JSON.parse(raw) : null;

        if (session && typeof session.id === 'string' && session.id.length > 0) state = 'in';
        if (state === 'in' && session.admin === true) admin = 'true';
        if (state === 'in' && session.onboarded === true) onboarded = 'true';
    } catch {
        state = 'out';
    }

    root.dataset.admin = admin;
    root.dataset.onboarded = onboarded;
    root.dataset.session = state;

    doc.addEventListener('astro:before-swap', (event) => {
        const next = event.newDocument.documentElement;

        next.dataset.admin = root.dataset.admin;
        next.dataset.onboarded = root.dataset.onboarded;
        next.dataset.session = root.dataset.session;
    });
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
    try {
        const raw = globalThis.localStorage.getItem(CART_KEY);

        const items = raw ? JSON.parse(raw) : [];

        return Array.isArray(items) ? items.length : 0;
    } catch {
        return 0;
    }
}

function readCartState() {
    return readCartRows() === 0 ? 'empty' : 'filled';
}

function readReceiptState() {
    let state = 'stale';

    try {
        const raw = globalThis.localStorage.getItem(ORDER_KEY);

        const order = raw ? JSON.parse(raw) : null;

        if (!order) state = 'none';
        else if (Date.now() - Number(order.placedAt) < RECEIPT_FRESH_MILLISECONDS) state = 'fresh';
    } catch {
        state = 'stale';
    }

    return state;
}

function retirePrototypeStore() {
    try {
        if (globalThis.localStorage.getItem(SEED_MARKER_KEY) === null) return;

        globalThis.localStorage.removeItem(CART_KEY);
        globalThis.localStorage.removeItem(SEED_MARKER_KEY);

        const raw = globalThis.localStorage.getItem(ORDER_KEY);

        const order = raw ? JSON.parse(raw) : null;

        if (typeof order?.account !== 'string') globalThis.localStorage.removeItem(ORDER_KEY);
    } catch {
        return;
    }
}

function scrollToAnchor() {
    const target = doc.getElementById(globalThis.location.hash.slice(1));

    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
}

initTheme();
initSessionState();
retirePrototypeStore();
initCartState();
initReceiptState();
initOnboardingState();
initMotionBridge();
initScrollRestore();
