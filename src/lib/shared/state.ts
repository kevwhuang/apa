interface PersistentStore<T> extends Store<T> {
    persisted(): boolean;
}

function createStore<T>(options: StoreOptions<T>): PersistentStore<T> {
    const { fallback, key, normalize, scope, topic } = options;

    let memoryValue: T | undefined;
    let written = true;

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

    function persisted(): boolean {
        return written;
    }

    function remove(): void {
        memoryValue = undefined;
        written = scope === 'memory' || removeRaw(key, scope);

        notify(topic);
    }

    function set(value: T): T {
        const next = normalizeValue(value);

        if (scope === 'memory') {
            memoryValue = next;
            written = true;
        } else {
            written = writeRaw(key, scope, JSON.stringify(next));
        }

        notify(topic);

        return next;
    }

    function update(updater: (value: T) => T): T {
        return set(updater(get()));
    }

    return { get, onChange, persisted, remove, set, update };
}

function getStorage(scope: StorageScope): Storage | null {
    return scope === 'local' && typeof localStorage !== 'undefined' ? localStorage : null;
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

function removeRaw(key: string, scope: StorageScope): boolean {
    const storage = getStorage(scope);

    if (!storage) return false;

    try {
        storage.removeItem(key);

        return true;
    } catch {
        return false;
    }
}

function unsubscribed(): void {
    return undefined;
}

function writeRaw(key: string, scope: StorageScope, raw: string): boolean {
    const storage = getStorage(scope);

    if (!storage) return false;

    try {
        storage.setItem(key, raw);

        return true;
    } catch {
        return false;
    }
}

export { createStore };
