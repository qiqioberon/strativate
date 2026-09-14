import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/checkout/page.tsx', 'utf8')
const embed = readFileSync('components/commerce/midtrans-embed.tsx', 'utf8')
const legacy = readFileSync('app/checkout/[slug]/page.tsx', 'utf8')

test('shared checkout GET is read-only and renders an existing Order snapshot', () => {
  assert.match(page, /getOrderWithItems/)
  assert.doesNotMatch(page, /createOrderFromCart|getActiveCart/)
  assert.match(page, /if\s*\(!requestedOrderId\)[\s\S]*redirect\(['"]\/cart['"]\)/)
  assert.match(page, /order\.items/)
  assert.match(page, /formatRupiah\(item\.unit_price_amount\)/)
  assert.match(page, /formatRupiah\(order\.total_amount\)/)
  assert.doesNotMatch(page, /shipping|courier|alamat pengiriman/i)
})

test('Midtrans uses official embedded Snap and backend reconciliation', () => {
  assert.match(embed, /window\.snap\.embed/)
  assert.match(embed, /embedId:\s*['"]midtrans-snap-container['"]/)
  assert.match(embed, /id="midtrans-snap-container"/)
  assert.match(embed, /\/api\/checkout\/start/)
  assert.match(embed, /\/api\/checkout\/status/)
  assert.doesNotMatch(embed, /window\.snap\.pay/)
  assert.doesNotMatch(embed, /redirect_url|window\.location/)
})

test('legacy slug checkout remains compatibility-only', () => {
  assert.match(legacy, /resolveMentoringSlug/)
  assert.match(legacy, /notFound\(\)/)
  assert.doesNotMatch(legacy, /createOrder|Midtrans|snap/i)
})
