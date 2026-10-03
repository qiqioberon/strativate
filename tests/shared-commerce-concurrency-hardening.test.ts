import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const migration = readFileSync(
  path.join(root, 'supabase/migrations/202610040004_shared_commerce_concurrency_hardening.sql'),
  'utf8',
)

function functionSql(name: string) {
  const marker = `create or replace function public.${name}`
  const start = migration.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist in the hardening migration`)
  const end = migration.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} must have a complete body`)
  return migration.slice(start, end + 4)
}

test('order creation materializes one authoritative commerce snapshot', () => {
  const sql = functionSql('create_order_from_cart')
  assert.equal((sql.match(/resolve_commerce_item\(/g) ?? []).length, 1)
  assert.match(sql, /v_commerce_snapshot jsonb/)
  assert.match(sql, /jsonb_agg\(/)
  assert.match(sql, /jsonb_to_recordset\(v_commerce_snapshot\)/)
  assert.match(sql, /perform public\.ensure_digital_product_purchase_claims\(v_order\.id\)/)
})

test('Digital Product active-or-paid purchase claims are database enforced and discoverable for UX', () => {
  assert.match(migration, /create table public\.commerce_digital_product_purchase_claims/)
  assert.match(migration, /primary key \(user_id, commerce_item_id\)/)
  assert.match(migration, /create or replace function public\.get_active_digital_product_order/)
  assert.match(migration, /o\.status = 'pending_payment'/)
  assert.match(migration, /Digital Product has an active payment/)
  assert.match(migration, /Digital Product is already owned/)
  assert.match(migration, /orders_sync_digital_product_purchase_claims/)
})

test('migration retires already-expired discounted pending Orders before active-purchase claim backfill', () => {
  const cleanup = migration.indexOf("update public.orders o\\nset status = 'expired'")
  const claimBackfill = migration.indexOf('with ranked as (')
  assert.ok(cleanup >= 0)
  assert.ok(claimBackfill > cleanup)
  assert.match(migration.slice(cleanup, claimBackfill), /reserved_until > now\(\)/)
})

test('terminal Orders are never silently reopened by payment reservation', () => {
  const sql = functionSql('reserve_midtrans_payment_attempt')
  assert.match(sql, /v_order\.status <> 'pending_payment'/)
  assert.match(sql, /Order is terminal; create a new checkout/)
  assert.doesNotMatch(sql, /set status = 'pending_payment'/)
})

test('payment functions lock Order before Payment Attempt and revalidate the relationship', () => {
  for (const name of ['reserve_midtrans_payment_attempt', 'apply_midtrans_payment_status']) {
    const sql = functionSql(name)
    const orderLock = sql.indexOf('select * into v_order')
    const attemptLock = sql.indexOf('select * into v_attempt')
    assert.ok(orderLock >= 0, `${name} must lock the Order`)
    assert.ok(attemptLock > orderLock, `${name} must lock Payment Attempt after the Order`)
    assert.ok(sql.indexOf('for update', orderLock) > orderLock, `${name} Order read must use FOR UPDATE`)
    assert.ok(sql.indexOf('for update', attemptLock) > attemptLock, `${name} Payment Attempt read must use FOR UPDATE`)
  }

  const apply = functionSql('apply_midtrans_payment_status')
  assert.match(apply, /v_attempt\.order_id <> v_order\.id/)
})

test('expired discounts durably expire the old Order and cannot transition it to paid', () => {
  const reserve = functionSql('reserve_midtrans_payment_attempt')
  const apply = functionSql('apply_midtrans_payment_status')
  const sync = functionSql('sync_discount_redemption_from_order_status')

  assert.match(reserve, /v_redemption\.reserved_until <= now\(\)/)
  assert.match(reserve, /update public\.orders[\s\S]*set status = 'expired'/)
  assert.match(reserve, /return null/)
  assert.match(sync, /status = 'reserved'[\s\S]*reserved_until > now\(\)/)
  assert.match(apply, /v_order\.status <> 'paid'[\s\S]*v_redemption\.reserved_until <= now\(\)/)
  assert.match(apply, /Discount reservation expired; create a new checkout/)
})

test('discounted payment attempts and stored Snap tokens are capped by the reservation deadline', () => {
  const reserve = functionSql('reserve_midtrans_payment_attempt')
  const store = functionSql('store_midtrans_snap_token')

  assert.match(migration, /add column payment_expires_at timestamptz/)
  assert.match(reserve, /v_payment_expires_at := v_redemption\.reserved_until/)
  assert.match(reserve, /payment_expires_at/)
  assert.match(store, /least\([\s\S]*interval '24 hours'[\s\S]*payment_expires_at/)
  assert.match(store, /snap_token_expires_at = v_token_expires_at/)
})
