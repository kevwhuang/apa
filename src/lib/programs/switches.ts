import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';
import { supabase } from '@lib/shared/supabase';

interface SwitchRow {
    id: string;
    is_open: boolean;
}

const store = createStore<Partial<SwitchState>>({
    fallback: {},
    key: STORAGE.switches.key,
    scope: STORAGE.switches.scope,
    topic: STORAGE.switches.topic,
});

const writtenAt: Record<SiteSwitch, number> = { assembly_intake: 0, bash_intake: 0, check_in: 0, signups: 0 };

let isLoading = false;
let sequence = 0;

function applySwitch(id: SiteSwitch, isOpen: boolean): void {
    sequence++;
    writtenAt[id] = sequence;
    store.update(value => ({ ...value, [id]: isOpen }));
}

function isSiteSwitch(value: string): value is SiteSwitch {
    return Object.hasOwn(writtenAt, value);
}

function isSwitchClosed(id: SiteSwitch): boolean {
    return store.get()[id] === false;
}

function isSwitchOpen(id: SiteSwitch): boolean {
    return store.get()[id] === true;
}

async function loadSwitches(): Promise<boolean> {
    isLoading = true;
    sequence++;

    const ticket = sequence;

    const { data, error } = await supabase.from('switches').select('id, is_open');

    isLoading = false;

    if (error) return false;

    const next = { ...store.get() };
    const rows: SwitchRow[] = data;

    for (const row of rows) {
        if (!isSiteSwitch(row.id) || writtenAt[row.id] > ticket) continue;

        next[row.id] = row.is_open;
        writtenAt[row.id] = ticket;
    }

    store.set(next);

    return true;
}

function onSwitchChange(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;

    if (!isLoading) void loadSwitches();

    return store.onChange(callback);
}

async function setSwitchOpen(id: SiteSwitch, isOpen: boolean): Promise<ActionResult> {
    const { count, error } = await supabase.from('switches').update({ is_open: isOpen }, { count: 'exact' }).eq('id', id);

    if (error || count !== 1) return { message: 'That switch could not be saved. Try again.', ok: false };

    applySwitch(id, isOpen);

    return { ok: true };
}

export { applySwitch, isSiteSwitch, isSwitchClosed, isSwitchOpen, loadSwitches, onSwitchChange, setSwitchOpen };
