import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const DEFAULT_THEME: Theme = 'light';
const META_SELECTOR = 'meta[name="theme-color"]';

const THEME_COLORS: Record<Theme, string> = {
    dark: '#141019',
    light: '#f6f1e4',
};

const store = createStore<Theme | null>({
    fallback: null,
    key: STORAGE.theme.key,
    normalize: normalizeTheme,
    scope: STORAGE.theme.scope,
    topic: STORAGE.theme.topic,
});

function getTheme(): Theme {
    return store.get() ?? DEFAULT_THEME;
}

function normalizeTheme(value: Theme | null): Theme | null {
    return value === 'dark' || value === 'light' ? value : null;
}

function setTheme(theme: Theme): void {
    stampTheme(theme);
    store.set(theme);
}

function stampTheme(theme: Theme): void {
    const meta = document.querySelector<HTMLMetaElement>(META_SELECTOR);

    document.documentElement.dataset.theme = theme;

    if (meta) meta.content = THEME_COLORS[theme];
}

function syncThemeAttribute(): void {
    if (typeof document === 'undefined') return;

    stampTheme(getTheme());
}

function toggleTheme(): Theme {
    const next = getTheme() === 'dark' ? 'light' : 'dark';

    setTheme(next);

    return next;
}

export { getTheme, setTheme, syncThemeAttribute, toggleTheme };
