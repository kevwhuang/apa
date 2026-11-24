import { FIELD_LIMITS } from '@lib/shared/constants';
import { isRecord } from '@lib/shared/utils';

import type { SupabaseClient } from '@supabase/supabase-js';

type PromoLookup = { ok: false } | { ok: true; promo: Promo | null };

async function loadPromo(admin: SupabaseClient, code: string): Promise<PromoLookup> {
    if (!code || code.length > FIELD_LIMITS.code) return { ok: true, promo: null };

    const { data, error } = await admin.rpc('get_promo_code', { p_code: code });

    if (error) return { ok: false };

    const row: unknown = data;

    if (!isRecord(row) || typeof row.code !== 'string' || typeof row.discount_basis_points !== 'number') return { ok: true, promo: null };

    return { ok: true, promo: { code: row.code, discountBasisPoints: row.discount_basis_points } };
}

export { loadPromo };
