interface LiveListOptions<T> {
    fetchPage: () => Promise<T[] | null>;
    getStamp: (row: T) => number;
    limit: number;
    onChange: (rows: T[]) => void;
    pageSize: number;
}

function createLiveList<T extends { id: string }>(options: LiveListOptions<T>): LiveList<T> {
    const { fetchPage, getStamp, limit, onChange, pageSize } = options;
    const rows = new Map<string, T>();
    const tombstones = new Set<string>();

    let arrivals: Map<string, T> | undefined;
    let generation = 0;
    let inflight: Promise<boolean> | undefined;

    function discard(id: string): void {
        arrivals?.delete(id);
        rows.delete(id);
        emit();
    }

    function emit() {
        const sorted = [...rows.values()].sort((a, b) => getStamp(a) - getStamp(b) || a.id.localeCompare(b.id));

        for (const row of sorted.slice(0, Math.max(0, sorted.length - limit))) {
            rows.delete(row.id);
        }

        onChange(sorted.slice(-limit));
    }

    async function load() {
        const started = generation;

        arrivals = new Map();

        const fresh = await fetchPage();

        if (started !== generation) return false;

        const landed = arrivals;

        arrivals = undefined;
        inflight = undefined;

        if (!fresh) return false;

        const floor = fresh.length < pageSize ? Number.NEGATIVE_INFINITY : Math.min(...fresh.map(getStamp));

        for (const [id, row] of rows) {
            if (getStamp(row) >= floor) rows.delete(id);
        }

        for (const row of [...fresh, ...landed.values()]) {
            if (!tombstones.has(row.id)) rows.set(row.id, row);
        }

        emit();

        return true;
    }

    function merge(entries: T[]): void {
        for (const row of entries) {
            if (!tombstones.has(row.id)) rows.set(row.id, row);
        }

        emit();
    }

    function remove(id: string): void {
        tombstones.add(id);
        rows.delete(id);
        emit();
    }

    function reset(): void {
        generation++;
        arrivals = undefined;
        inflight = undefined;
        rows.clear();
        tombstones.clear();
        emit();
    }

    function revalidate(): Promise<boolean> {
        inflight ??= load();

        return inflight;
    }

    function upsert(row: T): void {
        if (tombstones.has(row.id)) return;

        arrivals?.set(row.id, row);
        rows.set(row.id, row);
        emit();
    }

    return { discard, merge, remove, reset, revalidate, upsert };
}

export { createLiveList };
