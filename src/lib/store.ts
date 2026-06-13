const CHANGE_EVENT = 'apa:cart-changed';
const STORAGE_KEY = 'apa.cart';

function read(): CartItem[] {
    try {
        const items: CartItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

        return items.map(item => ({
            ...item,
            priceCents: Number(item.priceCents) || 0,
            quantity: Math.max(1, Math.trunc(Number(item.quantity)) || 1),
        }));
    } catch {
        return [];
    }
}

function variantKey(item: CartItem) {
    return `${item.productSlug}|${item.size ?? ''}|${item.color ?? ''}`;
}

function write(items: CartItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function add(item: CartItem): void {
    const items = read();

    const index = items.findIndex(existing => variantKey(existing) === variantKey(item));

    if (index >= 0) {
        items[index].quantity += item.quantity;
    } else {
        items.push(item);
    }

    write(items);
}

export function clear(): void {
    write([]);
}

export function count(items = read()): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}

export function getItems(): CartItem[] {
    return read();
}

export function onChange(callback: (items: CartItem[]) => void): () => void {
    const handler = () => callback(read());

    window.addEventListener(CHANGE_EVENT, handler);

    return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function remove(index: number): void {
    const items = read();

    items.splice(index, 1);
    write(items);
}

export function setQuantity(index: number, quantity: number): void {
    const items = read();

    if (!items[index]) return;

    items[index].quantity = Math.max(1, quantity);
    write(items);
}

export function subtotalCents(items = read()): number {
    return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}
