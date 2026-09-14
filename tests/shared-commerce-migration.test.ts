import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140005_shared_commerce.sql'

test('shared commerce migration is a forward migration after Phase 2A', () => {
  assert.equal(existsSync(migrationPath), true)
  const sql = readFileSync(migrationPath, 'utf8')
  for (const table of ['commerce_items', 'carts', 'cart_items', 'orders', 'order_items']) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'))
  }
  assert.doesNotMatch(sql, /create table public\.catalog_/i)
  assert.doesNotMatch(sql, /alter table public\.digital_products\s+disable row level security/i)
})

test('cart and order boundaries derive ownership and values inside PostgreSQL', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /auth\.uid\(\)/i)
  assert.match(sql, /onboarding_completed_at\s+is not null/i)
  assert.match(sql, /create unique index carts_one_active_per_user/i)
  assert.match(sql, /unique\s*\(cart_id,\s*commerce_item_id\)/i)
  assert.match(sql, /create function public\.create_order_from_cart\s*\(p_cart_id uuid\)/i)
  assert.match(sql, /sum\([^)]*price_amount/i)
  assert.doesNotMatch(sql, /create_order_from_cart\s*\([^)]*(price|total|user_id)/i)
})

test('order item snapshots and commerce identities survive source deletion', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /item_kind_snapshot/i)
  assert.match(sql, /name_snapshot/i)
  assert.match(sql, /slug_snapshot/i)
  assert.match(sql, /unit_price_amount/i)
  assert.match(sql, /update public\.commerce_items[\s\S]*is_available\s*=\s*false/i)
  assert.match(sql, /immutable/i)
})
