import { BRAND_THEME_COLORS } from '@lib/shared/brand';
import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const DEFAULT_THEME: Theme = 'light';
const META_SELECTOR = 'meta[name="theme-color"]';

const store = createStore<Theme | null>({
    fallback: null,
    key: STORAGE.theme.key,
    normalize: value => (value === 'dark' || value === 'light' ? value : null),
    scope: STORAGE.theme.scope,
    topic: STORAGE.theme.topic,
});

function getTheme(): Theme {
    return store.get() ?? DEFAULT_THEME;
}

function listThemeTransitions(runningAnimations: Set<Animation>) {
    return document.getAnimations().filter(animation => !runningAnimations.has(animation)
        && animation instanceof CSSTransition
        && animation.playState !== 'finished');
}

function settleThemeTransitions(runningAnimations: Set<Animation>) {
    let transitions = listThemeTransitions(runningAnimations);

    while (transitions.length) {
        transitions.forEach(animation => animation.finish());
        transitions = listThemeTransitions(runningAnimations);
    }
}

function stampTheme(theme: Theme) {
    const meta = document.querySelector<HTMLMetaElement>(META_SELECTOR);

    document.documentElement.dataset.theme = theme;

    if (meta) meta.content = BRAND_THEME_COLORS[theme];
}

function syncThemeAttribute(): void {
    if (typeof document === 'undefined') return;

    stampTheme(getTheme());
}

function toggleTheme(): Theme {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    const runningAnimations = new Set(document.getAnimations());

    stampTheme(next);
    store.set(next);
    settleThemeTransitions(runningAnimations);

    return next;
}

export { getTheme, syncThemeAttribute, toggleTheme };
