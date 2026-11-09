const WINDOW_ROWS = 5;

function fitRowWindow(scroller: HTMLElement): void {
    if (!scroller.checkVisibility()) return;

    const rows = scroller.querySelectorAll<HTMLTableRowElement>('tbody tr');

    const last = rows.item(WINDOW_ROWS - 1);

    if (rows.length <= WINDOW_ROWS) {
        scroller.style.setProperty('--scroll-slot-max', 'none');

        return;
    }

    const chrome = scroller.offsetHeight - scroller.clientTop - scroller.clientHeight;
    const divider = Number.parseFloat(getComputedStyle(last).borderBottomWidth) / 2 || 0;
    const edge = last.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top + scroller.scrollTop;

    scroller.style.setProperty('--scroll-slot-max', `${edge + divider + chrome}px`);
}

function observeRowWindow(scroller: HTMLElement, signal: AbortSignal): void {
    const table = scroller.querySelector('table');

    if (!table) return;

    const observer = new ResizeObserver(() => fitRowWindow(scroller));

    observer.observe(table);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

export { fitRowWindow, observeRowWindow };
