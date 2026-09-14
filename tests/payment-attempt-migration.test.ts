import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const historicalMigrationPath = 'supabase/migrations/202609140007_midtrans_payment_attempts.sql'
const hardeningMigrationPath = 'supabase/migrations/202609140008_phase2_payment_hardening.sql'

test('payment attempts follow shared commerce and the historical migration stays intact', () => {
  assert.equal(existsSync('supabase/migrations/202609140006_shared_commerce.sql'), true)
  assert.equal(existsSync(historicalMigrationPath), true)
  const sql = readFileSync(historicalMigrationPath, 'utf8')
  assert.match(sql, /create table public\.payment_attempts/i)
  assert.match(sql, /provider_order_id text not null unique/i)
  assert.match(sql, /create unique index payment_attempts_one_active_per_order/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on public\.payment_attempts from anon, authenticated/i)
})

test('payment hardening is a forward migration with explicit token validity and creation claims', () => {
  assert.equal(existsSync(hardeningMigrationPath), true)
  const sql = readFileSync(hardeningMigrationPath, 'utf8')
  assert.match(sql, /add column snap_token_created_at timestamptz/i)
  assert.match(sql, /add column snap_token_expires_at timestamptz/i)
  assert.match(sql, /add column snap_creation_claim_token uuid/i)
  assert.match(sql, /add column snap_creation_claim_expires_at timestamptz/i)
  assert.match(sql, /create (or replace )?function public\.claim_midtrans_snap_creation/i)
  assert.match(sql, /create (or replace )?function public\.release_midtrans_snap_creation/i)
  assert.match(sql, /create function public\.store_midtrans_snap_token\(p_attempt_id uuid, p_claim_token uuid, p_snap_token text\)/i)
  assert.match(sql, /interval '24 hours'/i)
  assert.match(sql, /interval '2 minutes'/i)
})

test('payment transition function preserves paid Orders against stale notifications', () => {
  const sql = readFileSync(historicalMigrationPath, 'utf8')
  assert.match(sql, /create function public\.apply_midtrans_payment_status/i)
  assert.match(sql, /status\s*=\s*'paid'/i)
  assert.match(sql, /paid_at\s*=\s*coalesce\([^,]+paid_at,\s*now\(\)\)/i)
  assert.match(sql, /if v_order\.status = 'paid'/i)
  assert.match(sql, /grant execute on function public\.apply_midtrans_payment_status[\s\S]*?to service_role/i)
  assert.doesNotMatch(sql, /grant execute on function public\.apply_midtrans_payment_status[\s\S]*?to authenticated/i)
})
