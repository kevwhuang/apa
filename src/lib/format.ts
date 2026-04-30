export function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatDateShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
}
