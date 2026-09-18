-- Paid invoice identity + durable transactional email outbox.
alter table public.orders add column if not exists invoice_number text;

create sequence if not exists public.strativate_invoice_sequence;

with ranked as (
  select id,
         row_number() over(order by coalesce(paid_at,updated_at,created_at),id) as seq,
         to_char(coalesce(paid_at,updated_at,created_at) at time zone 'UTC','YYYYMM') as paid_month
  from public.orders
  where status='paid' and invoice_number is null
)
update public.orders o
set invoice_number='STR-INV-'||r.paid_month||'-'||case when r.seq<1000000 then lpad(r.seq::text,6,'0') else r.seq::text end
from ranked r where r.id=o.id;

create unique index if not exists orders_invoice_number_unique
  on public.orders(invoice_number) where invoice_number is not null;

alter table public.orders drop constraint if exists orders_invoice_number_format;
alter table public.orders add constraint orders_invoice_number_format
  check(invoice_number is null or invoice_number ~ '^STR-INV-[0-9]{6}-[0-9]{6,}$');

do $$
declare v_max bigint;
begin
  select coalesce(max(substring(invoice_number from '([0-9]+)$')::bigint),0)
    into v_max from public.orders where invoice_number is not null;
  if v_max=0 then
    perform setval('public.strativate_invoice_sequence',1,false);
  else
    perform setval('public.strativate_invoice_sequence',v_max,true);
  end if;
end $$;

create or replace function public.assign_paid_order_invoice_number()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_seq bigint;
begin
  if new.status='paid' and new.invoice_number is null then
    v_seq:=nextval('public.strativate_invoice_sequence');
    new.invoice_number:='STR-INV-'||
      to_char(coalesce(new.paid_at,now()) at time zone 'UTC','YYYYMM')||'-'||
      case when v_seq<1000000 then lpad(v_seq::text,6,'0') else v_seq::text end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_invoice_number on public.orders;
create trigger orders_assign_invoice_number
before insert or update of status,paid_at on public.orders
for each row execute function public.assign_paid_order_invoice_number();

create table if not exists public.transactional_email_outbox(
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  order_id uuid references public.orders(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactional_email_outbox_order_idx on public.transactional_email_outbox(order_id,created_at desc);
create index if not exists transactional_email_outbox_pending_idx on public.transactional_email_outbox(status,next_attempt_at,created_at) where status in ('pending','failed','processing');

drop trigger if exists transactional_email_outbox_touch_updated_at on public.transactional_email_outbox;
create trigger transactional_email_outbox_touch_updated_at
before update on public.transactional_email_outbox
for each row execute function public.touch_updated_at();

alter table public.transactional_email_outbox enable row level security;
revoke all on public.transactional_email_outbox from public,anon,authenticated;
grant all on public.transactional_email_outbox to service_role;

create or replace function public.ensure_paid_invoice_delivery(p_order_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_order public.orders;
  v_email text;
  v_name text;
  v_items jsonb;
  v_payment jsonb;
  v_outbox_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.status<>'paid' then return null;end if;

  select u.email,
         nullif(btrim(coalesce(
           u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name',
           split_part(u.email,'@',1)
         )),'')
  into v_email,v_name
  from auth.users u
  where u.id=v_order.user_id;

  if v_email is null then
    raise exception 'Paid Order recipient email is unavailable' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',oi.id,
    'kind',oi.item_kind_snapshot,
    'name',oi.name_snapshot,
    'slug',oi.slug_snapshot,
    'unitPriceAmount',oi.unit_price_amount
  ) order by oi.created_at,oi.id),'[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id=v_order.id;

  select jsonb_build_object(
    'provider',pa.provider,
    'method',pa.payment_type,
    'transactionReference',pa.provider_transaction_id
  )
  into v_payment
  from public.payment_attempts pa
  where pa.order_id=v_order.id and pa.status='paid'
  order by pa.updated_at desc,pa.created_at desc,pa.id desc
  limit 1;

  insert into public.transactional_email_outbox(
    event_type,order_id,recipient_email,recipient_name,idempotency_key,payload
  )
  values(
    'paid_invoice',
    v_order.id,
    v_email,
    v_name,
    'order:'||v_order.id||':invoice-paid:'||lower(v_email),
    jsonb_build_object(
      'invoiceNumber',v_order.invoice_number,
      'orderId',v_order.id,
      'paidAt',v_order.paid_at,
      'buyer',jsonb_build_object('name',v_name,'email',v_email),
      'items',v_items,
      'subtotalAmount',v_order.total_amount,
      'totalAmount',v_order.total_amount,
      'currencyCode',v_order.currency_code,
      'payment',coalesce(v_payment,'{}'::jsonb)
    )
  )
  on conflict(idempotency_key) do nothing
  returning id into v_outbox_id;

  if v_outbox_id is null then
    select id into v_outbox_id
    from public.transactional_email_outbox
    where idempotency_key='order:'||v_order.id||':invoice-paid:'||lower(v_email);
  end if;

  return v_outbox_id;
end;
$$;

create or replace function public.enqueue_paid_invoice_on_order_transition()
returns trigger language plpgsql security definer set search_path='' as '
begin
  if new.status=''paid'' and old.status is distinct from ''paid'' then
    perform public.ensure_paid_invoice_delivery(new.id);
  end if;
  return new;
end;
';

drop trigger if exists orders_enqueue_paid_invoice on public.orders;
create trigger orders_enqueue_paid_invoice
after update of status on public.orders
for each row execute function public.enqueue_paid_invoice_on_order_transition();

create or replace function public.claim_paid_invoice_delivery(p_order_id uuid)
returns table(
  id uuid,
  recipient_email text,
  recipient_name text,
  idempotency_key text,
  payload jsonb
)
language plpgsql security definer set search_path='' as $$
begin
  return query
  with candidate as (
    select o.id
    from public.transactional_email_outbox o
    where o.order_id=p_order_id
      and o.event_type='paid_invoice'
      and (
        (o.status in ('pending','failed') and o.next_attempt_at<=now())
        or (o.status='processing' and o.locked_at<now()-interval '15 minutes')
      )
    order by o.created_at
    for update skip locked
    limit 1
  )
  update public.transactional_email_outbox o
  set status='processing',
      attempts=o.attempts+1,
      locked_at=now(),
      last_error=null
  from candidate c
  where o.id=c.id
  returning o.id,o.recipient_email,o.recipient_name,o.idempotency_key,o.payload;
end;
$$;

create or replace function public.list_due_paid_invoice_orders(p_limit integer default 20)
returns table(order_id uuid)
language sql security definer set search_path='' as '
  select distinct o.order_id
  from public.transactional_email_outbox o
  where o.event_type=''paid_invoice''
    and (
      (o.status in (''pending'',''failed'') and o.next_attempt_at<=now())
      or (o.status=''processing'' and o.locked_at<now()-interval ''15 minutes'')
    )
  order by o.order_id
  limit least(greatest(coalesce(p_limit,20),1),100);
';

create or replace function public.complete_paid_invoice_delivery(
  p_delivery_id uuid,
  p_sent boolean,
  p_error text default null
)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.transactional_email_outbox
  set status=case when p_sent then 'sent' else 'failed' end,
      sent_at=case when p_sent then coalesce(sent_at,now()) else sent_at end,
      locked_at=null,
      next_attempt_at=case
        when p_sent then next_attempt_at
        else now()+(interval '5 minutes' * least(greatest(attempts,1),12))
      end,
      last_error=case when p_sent then null else left(coalesce(p_error,'delivery-failed'),500) end
  where id=p_delivery_id and status='processing';
end;
$$;

revoke all on function public.assign_paid_order_invoice_number() from public,anon,authenticated;
revoke all on function public.ensure_paid_invoice_delivery(uuid) from public,anon,authenticated;
revoke all on function public.claim_paid_invoice_delivery(uuid) from public,anon,authenticated;
revoke all on function public.complete_paid_invoice_delivery(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.list_due_paid_invoice_orders(integer) from public,anon,authenticated;
grant execute on function public.ensure_paid_invoice_delivery(uuid) to service_role;
grant execute on function public.claim_paid_invoice_delivery(uuid) to service_role;
grant execute on function public.complete_paid_invoice_delivery(uuid,boolean,text) to service_role;
grant execute on function public.list_due_paid_invoice_orders(integer) to service_role;

comment on table public.transactional_email_outbox is
  'Server-only durable outbox for transactional delivery. Unique idempotency_key prevents duplicate scheduling.';
comment on column public.orders.invoice_number is
  'Stable readable invoice identity mapped to the canonical Order.';
