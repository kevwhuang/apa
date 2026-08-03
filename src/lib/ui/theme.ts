import { STORAGE } from '@lib/constants';
import { createStore } from '@lib/state';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const META_SELECTOR = 'meta[name="theme-color"]';

const THEME_COLORS: Record<Theme, string> = {
    dark: '#141019',
    light: '#f6f1e4',
};

let darkQuery: MediaQueryList | null = null;

const store = createStore<Theme | null>({
    fallback: null,
    key: STORAGE.theme.key,
    normalize: normalizeTheme,
    scope: STORAGE.theme.scope,
    topic: STORAGE.theme.topic,
});

function getDarkQuery(): MediaQueryList | null {
    if (typeof window === 'undefined') return null;

    if (darkQuery === null) {
        darkQuery = window.matchMedia(DARK_QUERY);
        darkQuery.addEventListener('change', handleSystemChange);
    }

    return darkQuery;
}

export function getTheme(): Theme {
    return store.get() ?? systemTheme();
}

function handleSystemChange(): void {
    if (store.get() !== null) return;

    stampTheme(systemTheme());
}

function normalizeTheme(value: Theme | null): Theme | null {
    return value === 'dark' || value === 'light' ? value : null;
}

export function setTheme(theme: Theme): void {
    stampTheme(theme);
    store.set(theme);
}

function stampTheme(theme: Theme): void {
    const meta = document.querySelector<HTMLMetaElement>(META_SELECTOR);

    document.documentElement.dataset.theme = theme;

    if (meta) meta.content = THEME_COLORS[theme];
}

export function syncThemeAttribute(): void {
    if (typeof document === 'undefined') return;

    getDarkQuery();
    stampTheme(getTheme());
}

function systemTheme(): Theme {
    return getDarkQuery()?.matches === true ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
    const next = getTheme() === 'dark' ? 'light' : 'dark';

    setTheme(next);

    return next;
}
