const ISLAND_SELECTOR = 'script[data-island-id]';

function onIslandLoad(handleLoad: (added: Element[], removed: Element[]) => void, signal: AbortSignal): void {
    const observer = new MutationObserver(records => reportIslandLoad(records, handleLoad));

    for (const script of document.querySelectorAll(ISLAND_SELECTOR)) {
        if (script.parentElement) observer.observe(script.parentElement, { childList: true });
    }

    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

function reportIslandLoad(records: MutationRecord[], handleLoad: (added: Element[], removed: Element[]) => void) {
    const added = records.flatMap(record => Array.from(record.addedNodes));
    const removed = records.flatMap(record => Array.from(record.removedNodes));

    if (!removed.some(node => node instanceof Element && node.matches(ISLAND_SELECTOR))) return;

    handleLoad(added.filter(node => node instanceof Element), removed.filter(node => node instanceof Element));
}

export { onIslandLoad };
