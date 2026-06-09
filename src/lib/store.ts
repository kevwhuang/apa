const EVT = 'apa:cart-changed';
const KEY = 'apa.cart';

function read(): CartItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
        return [];
    }
}

function write(items: CartItem[]): void {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVT, { detail: items }));
}

export function add(item: CartItem): void {
    const items = read();
    const key = `${item.productSlug}|${item.size ?? ''}|${item.color ?? ''}`;
    const idx = items.findIndex(i => `${i.productSlug}|${i.size ?? ''}|${i.color ?? ''}` === key);
    if (idx >= 0) items[idx].quantity += item.quantity;
    else items.push(item);
    write(items);
}

export function clear(): void {
    write([]);
}

export function count(items = read()): number {
    return items.reduce((s, i) => s + i.quantity, 0);
}

export function getItems(): CartItem[] {
    return read();
}

export function onChange(cb: (items: CartItem[]) => void): () => void {
    const handler = (e: Event) => cb((e as CustomEvent<CartItem[]>).detail ?? read());
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
}

export function remove(index: number): void {
    const items = read();
    items.splice(index, 1);
    write(items);
}

export function setQuantity(index: number, q: number): void {
    const items = read();
    if (!items[index]) return;
    items[index].quantity = Math.max(1, q);
    write(items);
}

export function subtotalCents(items = read()): number {
    return items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
}
