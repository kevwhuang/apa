import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const store = createStore<boolean>({
    fallback: false,
    key: STORAGE.tour.key,
    normalize: normalizeArmed,
    scope: STORAGE.tour.scope,
    topic: STORAGE.tour.topic,
});

function armTour(): void {
    store.set(true);
}

function disarmTour(): void {
    store.remove();
}

function isTourArmed(): boolean {
    return store.get();
}

function normalizeArmed(value: boolean): boolean {
    return value === true;
}

export { armTour, disarmTour, isTourArmed };
