import { isUpcoming, setHidden } from '@lib/shared/utils';

const SECOND_ENTRY = 2;

function applyGroup(elements: HTMLElement[]) {
    const later = filterByRole(elements, 'later');
    const next = filterByRole(elements, 'next');
    const upcoming = filterByRole(elements, 'upcoming');

    const count = [...next, ...upcoming].filter(isLive).length;
    const soonest = next.findIndex(isLive);

    filterByRole(elements, 'many').forEach(element => setHidden(element, count < SECOND_ENTRY));
    filterByRole(elements, 'past').forEach(element => setHidden(element, isLive(element)));
    filterByRole(elements, 'some').forEach(element => setHidden(element, count === 0));
    later.forEach((element, index) => setHidden(element, !isLive(element) || index < soonest));
    next.forEach((element, index) => setHidden(element, index !== soonest));
    upcoming.forEach(element => setHidden(element, !isLive(element)));
}

function applySchedule(): void {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-event-role]'));

    new Set(elements.map(element => element.dataset.eventGroup)).forEach((group) => {
        applyGroup(elements.filter(element => element.dataset.eventGroup === group));
    });

    document.querySelectorAll<HTMLElement>('[data-event-id]').forEach((element) => {
        if (element.closest('[hidden]')) element.removeAttribute('id');
        else element.id = element.dataset.eventId ?? '';
    });
}

function filterByRole(elements: HTMLElement[], role: string) {
    return elements.filter(element => element.dataset.eventRole === role);
}

function isLive(element: HTMLElement) {
    return isUpcoming(new Date(element.dataset.eventEnd ?? ''));
}

export { applySchedule };
