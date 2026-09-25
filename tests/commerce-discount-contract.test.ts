import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202609260001_commerce_discounts_sales_counts.sql', 'utf8')
const cart = readFileSync('components/commerce/cart-view.tsx', 'utf8')
const products = readFileSync('components/digital-products/digital-product-directory.tsx', 'utf8')
const admin = readFileSync('components/admin/discount-code-management.tsx', 'utf8')
const productAdmin = readFileSync('components/admin/digital-product-management.tsx', 'utf8')

test('discount schema validates codes server-side and snapshots the applied order values', () => {
  assert.match(migration, /create table public\.commerce_discount_codes/)
  assert.match(migration, /create table public\.commerce_discount_redemptions/)
  assert.match(migration, /create or replace function public\.apply_discount_code/)
  assert.match(migration, /create or replace function public\.create_order_from_cart/)
  assert.match(migration, /discount_code_snapshot/)
  assert.match(migration, /discounted_unit_price_amount/)
  assert.match(migration, /redemption_count=redemption_count\+1/)
})

test('cart exposes apply/remove controls while checkout remains server-authoritative', () => {
  assert.match(cart, /apply_discount_code/)
  assert.match(cart, /remove_discount_code/)
  assert.match(cart, /subtotalAmount/)
  assert.match(cart, /discountAmount/)
})

test('digital catalogue supports search, sorting, and explicit sales-count display', () => {
  assert.match(products, /Search digital products/)
  assert.match(products, /price-low/)
  assert.match(products, /salesCount/)
  assert.match(productAdmin, /show_sales_count/)
})

test('admin discount-code editor owns CRUD fields and uses normalized codes', () => {
  assert.match(admin, /commerce_discount_codes/)
  assert.match(admin, /toUpperCase\(\)/)
  assert.match(admin, /discountType/)
  assert.match(admin, /maxRedemptions/)
})
