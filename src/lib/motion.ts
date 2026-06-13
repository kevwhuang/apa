const COUNT_DURATION = 1_200;
const COUNT_EASE_EXPONENT = 3;
const COUNT_THRESHOLD = 0.5;
const REVEAL_ROOT_MARGIN = '100000px 0px -40px 0px';
const REVEAL_THRESHOLD = 0.12;

const observers: IntersectionObserver[] = [];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function animateCount(element: HTMLElement) {
    const raw = element.dataset.count ?? '0';
    const start = performance.now();
    const suffix = raw.replace(/[\d.]/g, '');
    const target = Number.parseFloat(raw);

    function frame(now: number) {
        const progress = Math.min((now - start) / COUNT_DURATION, 1);

        const eased = 1 - Math.pow(1 - progress, COUNT_EASE_EXPONENT);

        element.textContent = Math.round(target * eased) + suffix;

        if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

function handleCountEntries(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) return;

        animateCount(entry.target);
        observer.unobserve(entry.target);
    });
}

function handleRevealEntries(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
    });
}

function initCounters() {
    const elements = document.querySelectorAll<HTMLElement>('[data-count]');

    if (!elements.length) return;

    const observer = new IntersectionObserver(handleCountEntries, { threshold: COUNT_THRESHOLD });

    observers.push(observer);
    elements.forEach(element => observer.observe(element));
}

function initReveals() {
    const elements = document.querySelectorAll<HTMLElement>('.reveal, .reveal--stagger');

    if (!elements.length) return;

    document.querySelectorAll<HTMLElement>('.reveal--stagger').forEach((container) => {
        Array.from(container.children).forEach((child, index) => {
            if (child instanceof HTMLElement) child.style.setProperty('--reveal-index', String(index));
        });
    });

    const observer = new IntersectionObserver(handleRevealEntries, {
        rootMargin: REVEAL_ROOT_MARGIN,
        threshold: REVEAL_THRESHOLD,
    });

    observers.push(observer);
    elements.forEach(element => observer.observe(element));
}

export function initMotion(): void {
    observers.forEach(observer => observer.disconnect());
    observers.length = 0;

    if (prefersReducedMotion.matches) return;

    initCounters();
    initReveals();
}
