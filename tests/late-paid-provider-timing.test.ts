import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const migration = readFileSync(
  path.join(root, 'supabase/migrations/202610040007_midtrans_provider_payment_timing.sql'),
  'utf8',
).replaceAll('\r\n', '\n')
const midtrans = readFileSync(path.join(root, 'lib/payments/midtrans-server.ts'), 'utf8')
const application = readFileSync(path.join(root, 'lib/payments/application.ts'), 'utf8')

function functionSql(name: string, occurrence = 0) {
  const marker = `create or replace function public.${name}`
  let start = -1
  let offset = 0
  for (let index = 0; index <= occurrence; index += 1) {
    start = migration.indexOf(marker, offset)
    assert.notEqual(start, -1, `${name} occurrence ${occurrence} must exist`)
    offset = start + marker.length
  }
  const end = migration.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} must have a complete body`)
  return migration.slice(start, end + 4)
}

test('Midtrans parsing derives provider success timing from provider fields, never receipt time', () => {
  assert.match(midtrans, /settlementTime/)
  assert.match(midtrans, /providerSuccessAt/)
  assert.match(midtrans, /transactionStatus === 'settlement'[\s\S]*settlementTime/)
  assert.match(midtrans, /transactionStatus === 'capture'[\s\S]*transactionTime/)
  assert.match(midtrans, /Midtrans response has invalid \$\{field\}/)
  assert.doesNotMatch(midtrans, /providerSuccessAt\s*[:=][^\n]*Date\.now/)
})

test('application passes only normalized trusted provider success timing into the database RPC', () => {
  assert.match(application, /p_provider_success_at: status\.providerSuccessAt/)
  assert.match(application, /parseAndVerifyMidtransNotification/)
  assert.match(application, /notificationStatus\.normalizedStatus === 'paid'[\s\S]*getMidtransTransactionStatus\(notificationStatus\.orderId\)/)
  assert.match(application, /status\.orderId !== attempt\.provider_order_id/)
  assert.match(application, /assertAmountMatches\(attempt\.gross_amount, status\.grossAmount\)/)
})

test('discounted paid decision compares provider success time against persisted payment deadline', () => {
  const sql = functionSql('apply_midtrans_payment_status')
  assert.match(sql, /p_provider_success_at timestamptz/)
  assert.match(sql, /v_attempt\.payment_expires_at is null/)
  assert.match(sql, /v_payment_deadline := least\([\s\S]*payment_expires_at[\s\S]*reserved_until/)
  assert.match(sql, /p_provider_success_at > v_payment_deadline/)
  assert.match(sql, /p_provider_success_at is null/)
  assert.doesNotMatch(sql, /p_provider_success_at\s*[<>]=?\s*\(?now\(\)/)
  assert.doesNotMatch(sql, /interval '\d+ (seconds?|minutes?)'/i)
})

test('only locally expired discounted lifecycle is eligible for provider-timed reconciliation', () => {
  const sql = functionSql('apply_midtrans_payment_status')
  assert.match(sql, /v_order\.status in \('payment_failed', 'cancelled'\)/)
  assert.match(sql, /v_attempt\.status in \('failed', 'cancelled'\)/)
  assert.match(sql, /v_order\.status = 'expired'/)
  assert.match(sql, /v_previous_provider_status in \('', 'pending', 'authorize', 'capture', 'settlement'\)/)
  assert.match(sql, /v_redemption\.status in \('reserved', 'released'\)/)
})

test('accepted discounted paid transition stores provider success time as paid_at', () => {
  const sql = functionSql('apply_midtrans_payment_status')
  assert.match(sql, /when o\.discount_code_id is not null then p_provider_success_at/)
  assert.match(sql, /set status = 'paid'/)
  assert.match(sql, /perform public\.ensure_digital_product_purchase_claims\(v_order\.id\)/)
})

test('discount redemption trigger uses paid_at versus original deadline and can restore a locally released claim', () => {
  const sql = functionSql('sync_discount_redemption_from_order_status')
  assert.match(sql, /new\.paid_at > v_redemption\.reserved_until/)
  assert.match(sql, /v_redemption\.status not in \('reserved', 'released'\)/)
  assert.match(sql, /status in \('reserved', 'released'\)/)
  assert.match(sql, /insert into public\.commerce_discount_user_claims/)
  assert.match(sql, /discount_redemption_capacity_used/)
  assert.doesNotMatch(sql, /reserved_until > now\(\)/)
})

test('legacy six-argument RPC remains fail-closed for discounted paid timing', () => {
  const wrapper = functionSql('apply_midtrans_payment_status', 1)
  assert.match(wrapper, /null::timestamptz/)
  assert.match(migration, /grant execute on function public\.apply_midtrans_payment_status\([\s\S]*timestamptz[\s\S]*to service_role/)
})
