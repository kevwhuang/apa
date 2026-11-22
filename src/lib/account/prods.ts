import { NETWORK_MESSAGE, PRODS_NEGATIVE_MESSAGE } from '@lib/shared/constants';
import { supabase } from '@lib/shared/supabase';
import { toAustinIso } from '@lib/shared/utils';

interface AttendanceRow {
    checked_in_at: string;
    events: { label: string } | null;
}

interface LedgerRow {
    amount: number;
    balance: number;
    created_at: string;
    reason: string;
}

interface MemberRow {
    artist_name: string;
    created_at: string;
    email: string;
    id: string;
    prods: number;
}

const ERROR_CODES: Partial<Record<string, ProdsErrorCode>> = {
    member_unknown: 'member-unknown',
    not_admin: 'not-admin',
    prods_negative: 'negative',
};

const HISTORY_LIMIT = 200;
const MEMBERS_PAGE_SIZE = 1_000;

const MESSAGES: Record<ProdsErrorCode, string> = {
    'member-unknown': 'That member is no longer on the roster.',
    'negative': PRODS_NEGATIVE_MESSAGE,
    'not-admin': 'Only an admin can do that.',
    'unavailable': NETWORK_MESSAGE,
};

async function adjustProds(userId: string, amount: number, reason: string): Promise<ProdsResult> {
    const { data, error } = await supabase.rpc('adjust_prods', { p_amount: amount, p_reason: reason, p_user_id: userId });

    if (error || typeof data !== 'number') {
        const code = ERROR_CODES[error?.message ?? ''] ?? 'unavailable';

        return { code, message: MESSAGES[code], ok: false };
    }

    return { ok: true, prods: data };
}

async function loadAttendance(userId: string): Promise<ProdsAttendance[] | null> {
    const { data, error } = await supabase
        .from('checkins')
        .select('checked_in_at, events(label)')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(HISTORY_LIMIT)
        .overrideTypes<AttendanceRow[], { merge: false }>();

    if (error) return null;

    return data.map(toAttendance);
}

async function loadLedger(userId: string): Promise<ProdsRow[] | null> {
    const { data, error } = await supabase
        .from('prods_ledger')
        .select('amount, balance, created_at, reason')
        .eq('user_id', userId)
        .order('id', { ascending: false })
        .limit(HISTORY_LIMIT);

    if (error) return null;

    const rows: LedgerRow[] = data;

    return rows.map(toProdsRow);
}

async function loadMembers(): Promise<ProdsMember[] | null> {
    const members: ProdsMember[] = [];

    let page: MemberRow[];

    do {
        const { data, error } = await supabase.rpc('get_members').range(members.length, members.length + MEMBERS_PAGE_SIZE - 1);

        if (error) return null;

        page = data;
        members.push(...page.map(toMember));
    } while (page.length > 0);

    return members;
}

function toAttendance(row: AttendanceRow) {
    return { date: toAustinIso(new Date(row.checked_in_at)), event: row.events?.label ?? '' };
}

function toMember(row: MemberRow) {
    return {
        artistName: row.artist_name || row.email,
        email: row.email,
        id: row.id,
        joined: toAustinIso(new Date(row.created_at)),
        prods: row.prods,
    };
}

function toProdsRow(row: LedgerRow) {
    return { amount: row.amount, date: toAustinIso(new Date(row.created_at)), reason: row.reason, total: row.balance };
}

export { adjustProds, loadAttendance, loadLedger, loadMembers };
