import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

const store = createStore<boolean>({
    fallback: false,
    key: STORAGE.tour.key,
    normalize: value => value === true,
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

export { armTour, disarmTour, isTourArmed };
