import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140006_midtrans_payment_attempts.sql'

test('payment attempts are server-owned and separate from Orders', () => {
  assert.equal(existsSync(migrationPath), true)
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /create table public\.payment_attempts/i)
  assert.match(sql, /provider_order_id text not null unique/i)
  assert.match(sql, /create unique index payment_attempts_one_active_per_order/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on public\.payment_attempts from anon, authenticated/i)
})

test('payment transition function preserves paid Orders against stale notifications', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /create function public\.apply_midtrans_payment_status/i)
  assert.match(sql, /status\s*=\s*'paid'/i)
  assert.match(sql, /paid_at\s*=\s*coalesce\([^,]+paid_at,\s*now\(\)\)/i)
  assert.match(sql, /if v_order\.status = 'paid'/i)
  assert.match(sql, /grant execute on function public\.apply_midtrans_payment_status[^;]+to service_role/is)
  assert.doesNotMatch(sql, /grant execute on function public\.apply_midtrans_payment_status[^;]+to authenticated/is)
})
