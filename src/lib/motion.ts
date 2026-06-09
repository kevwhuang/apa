const COUNTER_DURATION = 1_200;

function initCounters(): void {
    const els = document.querySelectorAll<HTMLElement>('[data-count]');

    if (!els.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (!e.isIntersecting) return;

            const el = e.target as HTMLElement;
            const raw = el.dataset.count ?? '0';
            const suffix = raw.replace(/[\d.]/g, '');
            const target = parseFloat(raw);
            const start = performance.now();

            const tick = (now: number) => {
                const p = Math.min((now - start) / COUNTER_DURATION, 1);
                const ease = 1 - Math.pow(1 - p, 3);

                el.textContent = Math.round(target * ease) + suffix;

                if (p < 1) requestAnimationFrame(tick);
            };

            requestAnimationFrame(tick);
            io.unobserve(el);
        });
    }, { threshold: 0.5 });

    els.forEach(el => io.observe(el));
}

function initReveals(): void {
    const els = document.querySelectorAll('.reveal, .reveal--stagger');

    if (!els.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('is-visible');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => io.observe(el));
}

export function initMotion(): void {
    initCounters();
    initReveals();
}
