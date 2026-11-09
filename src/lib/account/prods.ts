import { STORAGE, WELCOME_PRODS } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

type ProdsLedgers = Record<string, ProdsEntry[]>;

interface ProdsAttendance {
    date: string;
    event: string;
}

interface ProdsEntry {
    amount: number;
    date: string;
    reason: string;
}

interface ProdsMember {
    artistName: string;
    email: string;
    joined: string;
    ledger: ProdsEntry[];
}

interface ProdsRow extends ProdsEntry {
    total: number;
}

const PRODS_MEMBERS: ProdsMember[] = [
    {
        artistName: 'Aephonics',
        email: 'kevin@aephonics.com',
        joined: '2022-05-01T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2022-05-01T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-05-23T00:00:00-05:00', reason: 'Tagged our social media' },
            { amount: 5, date: '2026-06-13T00:00:00-05:00', reason: 'Facilitated conversation' },
        ],
    },
    {
        artistName: 'Devon Park',
        email: 'devon.park@fastmail.com',
        joined: '2023-11-04T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2023-11-04T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-01-15T18:00:00-06:00', reason: 'Attended January 2026 Assembly' },
            { amount: 1, date: '2026-02-12T18:00:00-06:00', reason: 'Queued a demo' },
            { amount: 10, date: '2026-02-28T13:30:00-06:00', reason: 'Won Spring 2026 Bash' },
            { amount: 20, date: '2026-04-09T18:00:00-05:00', reason: 'Led a workshop' },
            { amount: 1, date: '2026-04-09T18:00:00-05:00', reason: 'Attended April 2026 Assembly' },
            { amount: 1, date: '2026-04-25T13:30:00-05:00', reason: 'Attended Summer 2026 Bash' },
            { amount: 1, date: '2026-05-21T18:00:00-05:00', reason: 'Attended May 2026 Assembly \u00b7 VonRyk' },
            { amount: -8, date: '2026-08-01T00:00:00-05:00', reason: 'Redeemed \u00b7 Legacy Tee' },
            { amount: -22, date: '2026-08-15T00:00:00-05:00', reason: 'Redeemed \u00b7 Alliance Tee' },
        ],
    },
    {
        artistName: 'Inez Rao',
        email: 'inez.rao@hey.com',
        joined: '2024-01-19T00:00:00-06:00',
        ledger: [
            { amount: 1, date: '2024-01-19T00:00:00-06:00', reason: 'Welcome Prod' },
            { amount: 10, date: '2025-10-25T13:30:00-05:00', reason: 'Won Winter 2025 Bash' },
            { amount: 1, date: '2026-06-11T18:00:00-05:00', reason: 'Attended June 2026 Assembly \u00b7 Alex LaCroix' },
        ],
    },
    {
        artistName: 'June Castillo',
        email: 'june.castillo@gmail.com',
        joined: '2024-02-08T00:00:00-06:00',
        ledger: [
            { amount: 1, date: '2024-02-08T00:00:00-06:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-02-12T18:00:00-06:00', reason: 'Queued a demo' },
            { amount: 3, date: '2026-05-21T18:00:00-05:00', reason: 'Gave a lightning talk' },
        ],
    },
    {
        artistName: 'Kojo Mensah',
        email: 'kojo.mensah@outlook.com',
        joined: '2024-03-27T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2024-03-27T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 2, date: '2026-07-25T13:30:00-05:00', reason: 'Got a sample accepted' },
            { amount: 1, date: '2026-07-25T13:30:00-05:00', reason: 'Attended Fall 2026 Bash' },
        ],
    },
    {
        artistName: 'Marcus Hale',
        email: 'marcus.hale@gmail.com',
        joined: '2023-09-12T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2023-09-12T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 10, date: '2026-01-17T00:00:00-06:00', reason: 'Organized a weekly meet' },
            { amount: -8, date: '2026-06-20T00:00:00-05:00', reason: 'Redeemed \u00b7 Legacy Tee' },
        ],
    },
    {
        artistName: 'Nightshift',
        email: 'nightshift@austinproduceralliance.com',
        joined: '2024-03-12T13:00:00-05:00',
        ledger: [
            { amount: 1, date: '2024-03-12T13:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2024-03-20T19:00:00-05:00', reason: 'Attended March 2024 Assembly \u00b7 Den Zuko' },
            { amount: 1, date: '2025-10-25T13:30:00-05:00', reason: 'Attended Winter 2025 Bash' },
            { amount: 1, date: '2026-04-25T13:30:00-05:00', reason: 'Attended Summer 2026 Bash' },
            { amount: 2, date: '2026-04-25T17:00:00-05:00', reason: 'Finished a Bash track' },
            { amount: -1, date: '2026-05-02T09:00:00-05:00', reason: 'Redeemed \u00b7 Store credit' },
            { amount: 1, date: '2026-06-11T18:00:00-05:00', reason: 'Attended June 2026 Assembly \u00b7 Alex LaCroix' },
            { amount: 1, date: '2026-07-09T18:00:00-05:00', reason: 'Attended July 2026 Assembly \u00b7 dk darkly' },
            { amount: 1, date: '2026-07-25T13:30:00-05:00', reason: 'Attended Fall 2026 Bash' },
        ],
    },
    {
        artistName: 'Otis Reed',
        email: 'otis.reed@gmail.com',
        joined: '2025-04-09T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2025-04-09T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2025-04-26T13:30:00-05:00', reason: 'Attended Summer 2025 Bash' },
            { amount: 1, date: '2025-06-07T13:30:00-05:00', reason: 'Attended June 2025 Assembly \u00b7 Henyx' },
            { amount: 2, date: '2025-09-27T13:30:00-05:00', reason: 'Finished a Bash track' },
            { amount: 1, date: '2025-09-27T13:30:00-05:00', reason: 'Attended Fall 2025 Bash' },
            { amount: 1, date: '2025-10-09T18:30:00-05:00', reason: 'Attended October 2025 Assembly \u00b7 Alex LaCroix' },
            { amount: -5, date: '2025-12-13T00:00:00-06:00', reason: 'Redeemed \u00b7 Alliance Samples I' },
            { amount: 1, date: '2026-02-28T13:30:00-06:00', reason: 'Attended Spring 2026 Bash' },
            { amount: 1, date: '2026-04-25T13:30:00-05:00', reason: 'Attended Summer 2026 Bash' },
            { amount: 1, date: '2026-07-09T18:00:00-05:00', reason: 'Attended July 2026 Assembly \u00b7 dk darkly' },
            { amount: 2, date: '2026-07-25T13:30:00-05:00', reason: 'Got a sample accepted' },
            { amount: 1, date: '2026-07-25T13:30:00-05:00', reason: 'Attended Fall 2026 Bash' },
            { amount: 1, date: '2026-09-10T18:00:00-05:00', reason: 'Attended September 2026 Assembly \u00b7 Jameson Sutton' },
            { amount: -1, date: '2026-10-03T00:00:00-05:00', reason: 'Redeemed \u00b7 Alliance Sticker' },
            { amount: 1, date: '2026-11-05T00:00:00-06:00', reason: 'Queued a demo' },
        ],
    },
    {
        artistName: 'Priya Nand',
        email: 'priya.nand@hey.com',
        joined: '2025-06-21T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2025-06-21T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-07-09T18:00:00-05:00', reason: 'Queued a demo' },
        ],
    },
    {
        artistName: 'Sasha Lin',
        email: 'sasha.lin@proton.me',
        joined: '2024-06-02T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2024-06-02T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-03-14T00:00:00-05:00', reason: 'Brought a friend' },
            { amount: 2, date: '2026-07-25T13:30:00-05:00', reason: 'Finished a Bash track' },
        ],
    },
    {
        artistName: 'Tana Wolfe',
        email: 'tana.wolfe@gmail.com',
        joined: '2024-08-15T00:00:00-05:00',
        ledger: [
            { amount: 1, date: '2024-08-15T00:00:00-05:00', reason: 'Welcome Prod' },
            { amount: 1, date: '2026-04-09T18:00:00-05:00', reason: 'Attended April 2026 Assembly' },
        ],
    },
];

const ATTENDED_PREFIX = 'Attended ';
const WELCOME_REASON = 'Welcome Prod';

const LEGACY_KEYS = new Map(PRODS_MEMBERS.map(member => [member.artistName.toLowerCase().replaceAll(' ', '_'), member.email]));
const SEED_LEDGERS: ProdsLedgers = Object.fromEntries(PRODS_MEMBERS.map(member => [member.email, member.ledger]));

const adjustments = createStore<ProdsLedgers>({
    fallback: {},
    key: STORAGE.adminProds.key,
    normalize: normalizeLedgers,
    scope: STORAGE.adminProds.scope,
    topic: STORAGE.adminProds.topic,
});

function addProdsEntry(email: string, entry: ProdsEntry): boolean {
    const key = email.toLowerCase();

    adjustments.update(value => ({ ...value, [key]: [...(value[key] ?? []), entry] }));

    return adjustments.persisted();
}

function getProdsAttendance(email: string, joined: number | string = Date.now()): ProdsAttendance[] {
    return getProdsLedger(email, joined)
        .filter(entry => entry.reason.startsWith(ATTENDED_PREFIX))
        .map(entry => ({ date: entry.date, event: entry.reason.slice(ATTENDED_PREFIX.length) }));
}

function getProdsBalance(email: string, joined: number | string = Date.now()): number {
    return getProdsLedger(email, joined).reduce((sum, entry) => sum + entry.amount, 0);
}

function getProdsLedger(email: string, joined: number | string = Date.now()): ProdsEntry[] {
    const key = email.toLowerCase();

    const start = SEED_LEDGERS[key] ?? [{ amount: WELCOME_PRODS, date: new Date(joined).toISOString(), reason: WELCOME_REASON }];

    return [...start, ...(adjustments.get()[key] ?? [])];
}

function getProdsRows(email: string, joined: number | string = Date.now()): ProdsRow[] {
    let total = 0;

    return getProdsLedger(email, joined).map((entry) => {
        total += entry.amount;

        return { ...entry, total };
    });
}

function isProdsEntry(entry: unknown): entry is ProdsEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    if (!('amount' in entry) || !('date' in entry) || !('reason' in entry)) return false;

    return Number.isInteger(entry.amount)
        && typeof entry.date === 'string'
        && !Number.isNaN(Date.parse(entry.date))
        && typeof entry.reason === 'string';
}

function normalizeLedgers(value: ProdsLedgers): ProdsLedgers {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

    const ledgers: ProdsLedgers = {};

    Object.entries(value).forEach(([key, entries]) => {
        if (!Array.isArray(entries)) return;

        const email = (LEGACY_KEYS.get(key) ?? key).toLowerCase();

        ledgers[email] = [...(ledgers[email] ?? []), ...entries.filter(isProdsEntry)];
    });

    return ledgers;
}

function onProdsChange(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;

    const controller = new AbortController();
    const unsubscribe = adjustments.onChange(callback);

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE.adminProds.key || event.key === null) callback();
    }, { signal: controller.signal });

    return () => {
        controller.abort();
        unsubscribe();
    };
}

export { PRODS_MEMBERS, addProdsEntry, getProdsAttendance, getProdsBalance, getProdsRows, onProdsChange };
