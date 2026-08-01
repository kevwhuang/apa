export function createStore<T>(options: StoreOptions<T>): Store<T> {
    const { fallback, key, normalize, scope, topic } = options;

    let memoryValue: T | undefined;

    function get(): T {
        if (scope === 'memory') return normalizeValue(memoryValue ?? fallback);

        const raw = readRaw(key, scope);

        if (raw === null) return normalizeValue(fallback);

        try {
            return normalizeValue(JSON.parse(raw) as T);
        } catch {
            return normalizeValue(fallback);
        }
    }

    function normalizeValue(value: T): T {
        if (!normalize) return value;

        try {
            return normalize(value);
        } catch {
            return fallback;
        }
    }

    function onChange(callback: (value: T) => void): () => void {
        if (typeof window === 'undefined') return unsubscribed;

        const handler = () => callback(get());

        window.addEventListener(topic, handler);

        return () => window.removeEventListener(topic, handler);
    }

    function remove(): void {
        memoryValue = undefined;

        if (scope !== 'memory') removeRaw(key, scope);

        notify(topic);
    }

    function set(value: T): T {
        const next = normalizeValue(value);

        if (scope === 'memory') {
            memoryValue = next;
        } else {
            writeRaw(key, scope, JSON.stringify(next));
        }

        notify(topic);

        return next;
    }

    function update(updater: (value: T) => T): T {
        return set(updater(get()));
    }

    return { get, onChange, remove, set, update };
}

function getStorage(scope: StorageScope): Storage | null {
    if (scope === 'local') return typeof localStorage === 'undefined' ? null : localStorage;
    if (scope === 'session') return typeof sessionStorage === 'undefined' ? null : sessionStorage;

    return null;
}

function notify(topic: string): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new Event(topic));
}

function readRaw(key: string, scope: StorageScope): string | null {
    const storage = getStorage(scope);

    if (!storage) return null;

    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function removeRaw(key: string, scope: StorageScope): void {
    const storage = getStorage(scope);

    if (!storage) return;

    try {
        storage.removeItem(key);
    } catch {
        return;
    }
}

function unsubscribed(): void {
    return undefined;
}

function writeRaw(key: string, scope: StorageScope, raw: string): void {
    const storage = getStorage(scope);

    if (!storage) return;

    try {
        storage.setItem(key, raw);
    } catch {
        return;
    }
}
