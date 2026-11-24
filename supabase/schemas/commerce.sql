create table public.orders (
    id bigint generated always as identity primary key,
    number text generated always as ('APA-' || lpad(id::text, greatest(5, length(id::text)), '0')) stored,
    user_id uuid references public.profiles (id) on delete set null,
    email text not null check (char_length(email) between 3 and 254),
    status text not null default 'pending' check (status in ('canceled', 'paid', 'pending', 'refunded')),
    items jsonb not null check (jsonb_typeof(items) = 'array'),
    shipping jsonb not null check (jsonb_typeof(shipping) = 'object'),
    promo_code text check (char_length(promo_code) <= 20),
    subtotal_cents integer not null check (subtotal_cents > 0),
    promo_cents integer not null default 0 check (promo_cents >= 0),
    tax_cents integer not null default 0 check (tax_cents >= 0),
    shipping_cents integer not null default 0 check (shipping_cents >= 0),
    prods_applied integer not null default 0 check (prods_applied >= 0),
    prods_cents integer not null default 0 check (prods_cents between 0 and prods_applied * 100),
    prods_debited integer not null default 0,
    total_cents integer not null check (total_cents >= 0),
    stripe_payment_intent_id text unique,
    placed_at timestamptz not null default now(),
    paid_at timestamptz,
    request_id uuid unique,
    constraint orders_prods_debited_check check (prods_debited between 0 and prods_applied),
    constraint orders_total_check check (total_cents = subtotal_cents - promo_cents + tax_cents + shipping_cents - prods_cents)
);

comment on table public.orders is 'One row per checkout attempt with its priced line items and address as an immutable snapshot. Written only by the order functions as service_role; members read their own. prods_debited is what settlement actually took, and what a refund gives back.';

create index orders_pending_placed_at_idx on public.orders (placed_at) where status = 'pending';
create index orders_user_id_placed_at_idx on public.orders (user_id, placed_at desc);

alter table public.orders enable row level security;

revoke all on table public.orders from anon, authenticated, service_role;
grant select on table public.orders to authenticated;
grant select, update on table public.orders to service_role;

create policy orders_select_own on public.orders
for select to authenticated
using (user_id = (select auth.uid()));

create table public.product_sales (
    product_slug text primary key check (product_slug ~ '^[a-z0-9_]{1,64}$'),
    units_sold integer not null default 0 check (units_sold >= 0),
    updated_at timestamptz not null default now()
);

comment on table public.product_sales is 'Units sold per product slug. Live stock is the Markdown stock minus this number.';

alter table public.product_sales enable row level security;

revoke all on table public.product_sales from anon, authenticated, service_role;
grant select on table public.product_sales to anon, authenticated;

create policy product_sales_select_all on public.product_sales
for select to anon, authenticated
using (true);

create table public.promo_codes (
    code text primary key check (code ~ '^[0-9A-Z]{1,20}$'),
    discount_basis_points integer not null check (discount_basis_points between 1 and 10000),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

comment on table public.promo_codes is 'Store discount codes in upper case with the share of the subtotal each takes off, in basis points. Rows are added by hand in SQL so that no code sits in the repository. No API role can read the table; the order routes ask get_promo_code as service_role.';

alter table public.promo_codes enable row level security;

revoke all on table public.promo_codes from anon, authenticated, service_role;

create view public.promo_code_usage
with (security_invoker = true)
as
select
    o.promo_code as code,
    count(*) filter (where o.status = 'paid') as paid_orders,
    count(*) filter (where o.status = 'refunded') as refunded_orders,
    coalesce(sum(o.promo_cents) filter (where o.status = 'paid'), 0) as paid_discount_cents
from public.orders o
where o.promo_code is not null and o.status in ('paid', 'refunded')
group by o.promo_code;

comment on view public.promo_code_usage is 'Uses per discount code, counted from orders. A use is a paid order; a refunded order leaves that count and is listed beside it; pending and canceled orders never count. No API role can read it, so it is seen in the dashboard only.';

revoke all on table public.promo_code_usage from anon, authenticated, service_role;

create function private.settle_order(p_order_id bigint, p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_debit integer := 0;
    v_held integer;
    v_order public.orders;
    v_titles text[];
begin
    select o.* into v_order from public.orders o where o.id = p_order_id for update;

    if not found then
        return 'missing';
    end if;

    if v_order.status in ('paid', 'refunded') then
        return v_order.status;
    end if;

    if v_order.prods_applied > 0 then
        select p.prods into v_balance from public.profiles p where p.id = v_order.user_id for update;

        v_debit := least(v_order.prods_applied, coalesce(v_balance, 0));

        if v_order.status = 'canceled' then
            select coalesce(sum(o.prods_applied), 0)::integer into v_held
            from public.orders o
            where o.user_id = v_order.user_id and o.status = 'pending';

            if coalesce(v_balance, 0) - v_held < v_order.prods_applied then
                return 'canceled';
            end if;
        end if;
    end if;

    insert into public.product_sales as s (product_slug, units_sold)
    select i.product_slug, sum(i.quantity)::integer
    from jsonb_to_recordset(v_order.items) as i (product_slug text, quantity integer)
    group by i.product_slug
    order by i.product_slug
    on conflict (product_slug) do update
    set units_sold = s.units_sold + excluded.units_sold, updated_at = now();

    if v_debit > 0 then
        select array_agg(distinct i.title) into v_titles
        from jsonb_to_recordset(v_order.items) as i (title text);

        perform private.add_prods(
            v_order.user_id,
            -v_debit,
            left('Redeemed ' || chr(183) || ' ' || case when cardinality(v_titles) = 1 then v_titles[1] else 'Order ' || v_order.number end, 120)
        );
    end if;

    update public.orders o
    set paid_at = now(),
        prods_debited = v_debit,
        status = 'paid',
        stripe_payment_intent_id = coalesce(p_payment_intent, o.stripe_payment_intent_id)
    where o.id = p_order_id;

    return 'paid';
end;
$$;

revoke execute on function private.settle_order(bigint, text) from public;
grant execute on function private.settle_order(bigint, text) to service_role;

create function private.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_request_id uuid,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance integer;
    v_line record;
    v_order public.orders;
    v_reserved integer;
    v_sold integer;
    v_superseded text[];
begin
    perform 1
    from public.orders o
    where o.status = 'pending'
        and (o.user_id = p_user_id or (p_user_id is null and o.user_id is null and lower(o.email) = lower(p_email)))
    order by o.id
    for update;

    if p_prods > 0 then
        select p.prods into v_balance from public.profiles p where p.id = p_user_id for update;
    end if;

    if p_request_id is not null then
        select o.* into v_order from public.orders o where o.request_id = p_request_id and o.user_id = p_user_id;

        if found then
            return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', '[]'::jsonb);
        end if;
    end if;

    if p_prods > 0 and (v_balance is null or v_balance < p_prods) then
        raise exception 'prods_negative';
    end if;

    with canceled as (
        update public.orders o
        set status = 'canceled'
        where o.status = 'pending'
            and (o.user_id = p_user_id or (p_user_id is null and o.user_id is null and lower(o.email) = lower(p_email)))
        returning o.stripe_payment_intent_id
    )
    select coalesce(array_agg(c.stripe_payment_intent_id) filter (where c.stripe_payment_intent_id is not null), '{}')
    into v_superseded
    from canceled c;

    for v_line in
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(p_items) as i (product_slug text, quantity integer)
        group by i.product_slug
        order by i.product_slug
    loop
        insert into public.product_sales (product_slug)
        values (v_line.product_slug)
        on conflict (product_slug) do nothing;

        select s.units_sold into v_sold from public.product_sales s where s.product_slug = v_line.product_slug for update;

        select coalesce(sum((i ->> 'quantity')::integer), 0) into v_reserved
        from public.orders o
        cross join jsonb_array_elements(o.items) as i
        where o.status = 'pending'
            and o.placed_at > now() - interval '10 minutes'
            and i ->> 'product_slug' = v_line.product_slug;

        if v_sold + v_reserved + v_line.quantity > coalesce((p_stock ->> v_line.product_slug)::integer, 0) then
            raise exception 'order_conflict';
        end if;
    end loop;

    insert into public.orders (email, items, prods_applied, prods_cents, promo_cents, promo_code, request_id, shipping, subtotal_cents, tax_cents, total_cents, user_id)
    values (p_email, p_items, p_prods, p_prods_cents, p_promo_cents, nullif(p_promo_code, ''), p_request_id, p_shipping, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id)
    returning * into v_order;

    if p_total_cents = 0 then
        perform private.settle_order(v_order.id, null);
    end if;

    return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'placed_at', v_order.placed_at, 'superseded', to_jsonb(v_superseded));
end;
$$;

revoke execute on function private.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) from public;
grant execute on function private.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

create function private.refund_order(p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_order public.orders;
begin
    select o.* into v_order from public.orders o where o.stripe_payment_intent_id = p_payment_intent for update;

    if not found then
        return 'missing';
    end if;

    if v_order.status <> 'paid' then
        return v_order.status;
    end if;

    if v_order.prods_debited > 0 and v_order.user_id is not null then
        perform private.add_prods(v_order.user_id, v_order.prods_debited, 'Refunded ' || chr(183) || ' Order ' || v_order.number);
    end if;

    perform 1
    from public.product_sales s
    where s.product_slug in (select i.product_slug from jsonb_to_recordset(v_order.items) as i (product_slug text))
    order by s.product_slug
    for update;

    update public.product_sales as s
    set units_sold = greatest(0, s.units_sold - r.quantity), updated_at = now()
    from (
        select i.product_slug, sum(i.quantity)::integer as quantity
        from jsonb_to_recordset(v_order.items) as i (product_slug text, quantity integer)
        group by i.product_slug
    ) as r
    where s.product_slug = r.product_slug;

    update public.orders o set status = 'refunded' where o.id = v_order.id;

    return 'refunded';
end;
$$;

revoke execute on function private.refund_order(text) from public;
grant execute on function private.refund_order(text) to service_role;

create function private.get_promo_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object('code', c.code, 'discount_basis_points', c.discount_basis_points)
    from public.promo_codes c
    where c.code = upper(btrim(coalesce(p_code, ''))) and c.is_active;
$$;

revoke execute on function private.get_promo_code(text) from public;
grant execute on function private.get_promo_code(text) to service_role;

create function public.place_order(
    p_email text,
    p_items jsonb,
    p_prods integer,
    p_prods_cents integer,
    p_promo_cents integer,
    p_promo_code text,
    p_request_id uuid,
    p_shipping jsonb,
    p_stock jsonb,
    p_subtotal_cents integer,
    p_tax_cents integer,
    p_total_cents integer,
    p_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.place_order(p_email, p_items, p_prods, p_prods_cents, p_promo_cents, p_promo_code, p_request_id, p_shipping, p_stock, p_subtotal_cents, p_tax_cents, p_total_cents, p_user_id);
$$;

revoke execute on function public.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.place_order(text, jsonb, integer, integer, integer, text, uuid, jsonb, jsonb, integer, integer, integer, uuid) to service_role;

create function public.settle_order(p_order_id bigint, p_payment_intent text)
returns text
language sql
security invoker
set search_path = ''
as $$
    select private.settle_order(p_order_id, p_payment_intent);
$$;

revoke execute on function public.settle_order(bigint, text) from public, anon, authenticated;
grant execute on function public.settle_order(bigint, text) to service_role;

create function public.refund_order(p_payment_intent text)
returns text
language sql
security invoker
set search_path = ''
as $$
    select private.refund_order(p_payment_intent);
$$;

revoke execute on function public.refund_order(text) from public, anon, authenticated;
grant execute on function public.refund_order(text) to service_role;

create function public.get_promo_code(p_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select private.get_promo_code(p_code);
$$;

revoke execute on function public.get_promo_code(text) from public, anon, authenticated;
grant execute on function public.get_promo_code(text) to service_role;
