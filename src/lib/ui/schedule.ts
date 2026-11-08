import { SECOND_ENTRY } from '@lib/shared/constants';
import { formatEntry, isUpcoming, setHidden, setText } from '@lib/shared/utils';

function applyGroup(elements: HTMLElement[]): void {
    const later = filterByRole(elements, 'later');
    const next = filterByRole(elements, 'next');
    const upcoming = filterByRole(elements, 'upcoming');

    const count = [...next, ...upcoming].filter(isLive).length;
    const soonest = next.findIndex(isLive);

    filterByRole(elements, 'many').forEach(element => setHidden(element, count < SECOND_ENTRY));
    filterByRole(elements, 'none').forEach(element => setHidden(element, count > 0));
    filterByRole(elements, 'past').forEach(element => setHidden(element, isLive(element)));
    filterByRole(elements, 'some').forEach(element => setHidden(element, count === 0));
    later.forEach((element, index) => setHidden(element, !isLive(element) || index < soonest));
    next.forEach((element, index) => setHidden(element, index !== soonest));
    next.forEach(element => setText(element.querySelector('[data-event-total]'), formatEntry(count)));
    upcoming.forEach(element => setHidden(element, !isLive(element)));

    later
        .filter(element => !element.hidden)
        .forEach((element, index) => setText(element.querySelector('[data-event-rank]'), formatEntry(index + SECOND_ENTRY)));
}

function applySchedule(): void {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-event-role]'));

    new Set(elements.map(element => element.dataset.eventGroup)).forEach((group) => {
        applyGroup(elements.filter(element => element.dataset.eventGroup === group));
    });

    document.querySelectorAll<HTMLElement>('[data-event-id]').forEach(syncAnchor);
    document.querySelectorAll<HTMLElement>('[data-event-tally]').forEach(syncTally);
}

function filterByRole(elements: HTMLElement[], role: string): HTMLElement[] {
    return elements.filter(element => element.dataset.eventRole === role);
}

function isLive(element: HTMLElement): boolean {
    return isUpcoming(new Date(element.dataset.eventEnd ?? ''));
}

function syncAnchor(element: HTMLElement): void {
    if (element.closest('[hidden]')) element.removeAttribute('id');
    else element.id = element.dataset.eventId ?? '';
}

function syncTally(list: HTMLElement): void {
    const eyebrow = document.getElementById(list.dataset.eventTally ?? '')?.previousElementSibling ?? null;
    const shown = list.querySelectorAll(':scope > :not([hidden])').length;

    setText(eyebrow, eyebrow?.textContent?.replace(/\d+/, String(shown)) ?? '');
}

export { applySchedule };
