import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const migration = readFileSync(
  path.join(root, 'supabase/migrations/202610040004_shared_commerce_concurrency_hardening.sql'),
  'utf8',
).replaceAll('\r\n', '\n')
const reservationMigration = readFileSync(
  path.join(root, 'supabase/migrations/202610040006_shared_commerce_reservation_invariants.sql'),
  'utf8',
).replaceAll('\r\n', '\n')

function functionSql(name: string) {
  const marker = `create or replace function public.${name}`
  const start = migration.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist in the hardening migration`)
  const end = migration.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} must have a complete body`)
  return migration.slice(start, end + 4)
}

function reservationFunctionSql(name: string) {
  const marker = `create or replace function public.${name}`
  const start = reservationMigration.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist in the reservation hardening migration`)
  const end = reservationMigration.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} must have a complete body`)
  return reservationMigration.slice(start, end + 4)
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
  const cleanup = migration.indexOf("update public.orders o\nset status = 'expired'")
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

test('order creation locks every mutable commerce source before resolving each item once', () => {
  const sql = reservationFunctionSql('create_order_from_cart')
  const sourceLock = sql.indexOf('lock_cart_commerce_snapshot_sources')
  const resolution = sql.indexOf('resolve_commerce_item(')

  assert.ok(sourceLock >= 0)
  assert.ok(resolution > sourceLock)
  assert.equal((sql.match(/resolve_commerce_item\(/g) ?? []).length, 1)
  assert.match(sql, /jsonb_to_recordset\(v_commerce_snapshot\)/)

  const lockSql = reservationFunctionSql('lock_cart_commerce_snapshot_sources')
  for (const table of [
    'digital_products',
    'private_mentoring_cart_link_offers',
    'private_mentoring_packages',
    'mentor_tiers',
    'intensive_mentoring_packages',
    'intensive_mentoring_add_ons',
    'intensive_mentoring_bundles',
    'intensive_mentoring_bundle_items',
    'intensive_mentoring_custom_offers',
    'commerce_items',
  ]) {
    assert.match(lockSql, new RegExp(`public\\.${table}`), `${table} must be row-locked`)
  }
  assert.match(lockSql, /order by/)
  assert.match(lockSql, /for update/g)

  const bundle = lockSql.indexOf('from public.intensive_mentoring_bundles source')
  const bundleItems = lockSql.indexOf('from public.intensive_mentoring_bundle_items source')
  const registry = lockSql.indexOf('from public.commerce_items source')
  const referencedPackage = lockSql.indexOf('from public.intensive_mentoring_packages source', bundle)
  const referencedAddOn = lockSql.indexOf('from public.intensive_mentoring_add_ons source', bundle)
  assert.ok(bundle >= 0 && referencedPackage > bundle)
  assert.ok(referencedAddOn > bundle && referencedAddOn < registry)
  assert.ok(referencedPackage < registry && registry < bundleItems)
  assert.match(reservationMigration, /create trigger intensive_bundle_items_lock_parent/)
})

test('voucher reservations use one 60-minute source of truth and cart application does not reserve', () => {
  const ttl = reservationFunctionSql('commerce_discount_reservation_ttl')
  const apply = reservationFunctionSql('apply_discount_code')
  const create = reservationFunctionSql('create_order_from_cart')

  assert.match(ttl, /interval '60 minutes'/)
  assert.match(create, /public\.commerce_discount_reservation_ttl\(\)/)
  assert.doesNotMatch(create, /interval '24 hours'/)
  assert.doesNotMatch(apply, /insert into public\.commerce_discount_(redemptions|user_claims)/)
})

test('voucher user claims enforce one active reservation and one lifetime redemption', () => {
  assert.match(reservationMigration, /create table public\.commerce_discount_user_claims/)
  assert.match(reservationMigration, /primary key \(user_id, discount_code_id\)/)
  assert.match(reservationMigration, /status text not null check \(status in \('reserved', 'redeemed'\)\)/)
  assert.match(reservationMigration, /order_id uuid not null unique references public\.orders\(id\)(?! on delete cascade)/)

  const create = reservationFunctionSql('create_order_from_cart')
  const sync = reservationFunctionSql('sync_discount_redemption_from_order_status')
  const apply = reservationFunctionSql('apply_discount_code')
  const eligibility = reservationFunctionSql('assert_discount_user_eligible')
  assert.match(create, /insert into public\.commerce_discount_user_claims/)
  assert.match(create, /Discount code already has an active reservation for this user/)
  assert.match(apply, /assert_discount_user_eligible\(v_uid, v_discount_code_id\)/)
  assert.match(eligibility, /Discount code has already been redeemed by this user/)
  assert.match(sync, /set status = 'redeemed'/)
  assert.match(sync, /delete from public\.commerce_discount_user_claims/)
})

test('voucher claim backfill expires legacy active holds for users who already redeemed', () => {
  const claimsTable = reservationMigration.indexOf('create table public.commerce_discount_user_claims')
  const cleanup = reservationMigration.indexOf('-- A successful historical use')
  assert.ok(cleanup >= 0)
  assert.ok(cleanup < claimsTable)
  const cleanupSql = reservationMigration.slice(cleanup, claimsTable)
  assert.match(cleanupSql, /redeemed/)
  assert.match(cleanupSql, /update public\.payment_attempts/)
  assert.match(cleanupSql, /update public\.orders/)
  assert.match(cleanupSql, /set status = 'expired'/)
})

test('migration cleanup locks each Order before expiring its Payment Attempts', () => {
  const claimsTable = reservationMigration.indexOf('create table public.commerce_discount_user_claims')
  const cleanupSql = reservationMigration.slice(0, claimsTable)
  const cleanupLoops = cleanupSql.match(
    /for v_order_id in[\s\S]*?order by o\.id[\s\S]*?for update[\s\S]*?update public\.payment_attempts[\s\S]*?update public\.orders[\s\S]*?end loop;/g,
  ) ?? []

  assert.equal(cleanupLoops.length, 3)
})

test('Snap claim, store, reserve, and status functions lock Order before Payment Attempt', () => {
  for (const name of [
    'reserve_midtrans_payment_attempt',
    'claim_midtrans_snap_creation',
    'store_midtrans_snap_token',
    'release_midtrans_snap_creation',
    'apply_midtrans_payment_status',
  ]) {
    const sql = reservationFunctionSql(name)
    const orderLock = sql.indexOf('select * into v_order')
    const attemptLock = sql.indexOf('select * into v_attempt')
    assert.ok(orderLock >= 0, `${name} must lock the Order`)
    assert.ok(attemptLock > orderLock, `${name} must lock Payment Attempt after the Order`)
    assert.ok(sql.indexOf('for update', orderLock) > orderLock)
    assert.ok(sql.indexOf('for update', attemptLock) > attemptLock)
  }

  const reserve = reservationFunctionSql('reserve_midtrans_payment_attempt')
  const reserveAttempt = reserve.indexOf('select * into v_attempt')
  const reserveRedemption = reserve.indexOf('select * into v_redemption')
  assert.ok(reserveAttempt >= 0 && reserveRedemption > reserveAttempt)
})

test('late paid status durably expires a discounted Order instead of rolling expiration back', () => {
  const sql = reservationFunctionSql('apply_midtrans_payment_status')
  assert.match(sql, /v_redemption\.reserved_until <= v_now/)
  assert.match(sql, /set status = 'expired'/)
  assert.match(sql, /update public\.orders[\s\S]*set status = 'expired'/)
  assert.doesNotMatch(sql, /raise exception 'Discount reservation expired/)
})
