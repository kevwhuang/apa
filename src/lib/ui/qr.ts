import { encode } from 'uqr';

const QUIET_ZONE_MODULES = 4;

function buildQrPath(text: string): { path: string; size: number } {
    const { data } = encode(text, { border: QUIET_ZONE_MODULES, ecc: 'M' });

    return { path: data.map(toRowPath).join(''), size: data.length };
}

function toRowPath(row: boolean[], y: number) {
    const runs: string[] = [];

    let start = -1;

    row.forEach((isDark, x) => {
        if (isDark && start < 0) start = x;

        if (!isDark && start >= 0) {
            runs.push(toRunPath(start, y, x - start));
            start = -1;
        }
    });

    if (start >= 0) runs.push(toRunPath(start, y, row.length - start));

    return runs.join('');
}

function toRunPath(x: number, y: number, length: number) {
    return `M${x} ${y}h${length}v1h-${length}z`;
}

export { buildQrPath };
