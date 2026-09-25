import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildTrustedMidtransItems } from '../lib/payments/trusted-order'

const application = readFileSync('lib/payments/application.ts', 'utf8')
const startRoute = readFileSync('app/api/checkout/start/route.ts', 'utf8')
const statusRoute = readFileSync('app/api/checkout/status/route.ts', 'utf8')
const webhookRoute = readFileSync('app/api/payments/midtrans/webhook/route.ts', 'utf8')

test('checkout start uses trusted Order snapshots and one-owner Snap creation claims', () => {
  assert.match(application, /reserve_midtrans_payment_attempt/)
  assert.match(application, /claim_midtrans_snap_creation/)
  assert.match(application, /createMidtransSnapTransaction/)
  assert.match(application, /order\.total_amount/)
  assert.match(application, /buildTrustedMidtransItems/)
  assert.match(application, /itemTotal/)
  assert.match(application, /store_midtrans_snap_token/)
  assert.match(application, /release_midtrans_snap_creation/)
  assert.match(application, /randomUUID/)
  assert.doesNotMatch(startRoute, /price|gross_amount|paid_status/i)
  assert.doesNotMatch(startRoute, /MIDTRANS_SERVER_KEY/)
})

test('status and webhook share the trusted payment transition application layer', () => {
  assert.match(statusRoute, /reconcileOwnedOrderPayment/)
  assert.match(webhookRoute, /reconcileMidtransWebhook/)
  assert.match(application, /apply_midtrans_payment_status/)
  assert.match(application, /parseIdrGrossAmount/)
  assert.match(application, /provider_order_id/)
})

test('webhook is sessionless and verifies Midtrans before applying state', () => {
  assert.match(application, /parseAndVerifyMidtransNotification/)
  assert.doesNotMatch(webhookRoute, /getAccount|requiredAccount|auth\.getUser/)
})


test('trusted Midtrans items preserve normal authoritative Order prices', () => {
  const items = buildTrustedMidtransItems({
    total_amount: 125_000,
    items: [
      { commerce_item_id: 'product-a', unit_price_amount: 75_000, discounted_unit_price_amount: null, name_snapshot: 'Product A' },
      { commerce_item_id: 'product-b', unit_price_amount: 50_000, discounted_unit_price_amount: null, name_snapshot: 'Product B' },
    ],
  } as never)
  assert.deepEqual(items.map(item => item.price), [75_000, 50_000])
  assert.equal(items.reduce((sum, item) => sum + item.price * item.quantity, 0), 125_000)
})

test('trusted Midtrans items use discounted snapshots and ignore client-shaped prices', () => {
  const order = {
    total_amount: 100_000,
    items: [
      { commerce_item_id: 'product-a', unit_price_amount: 100_000, discounted_unit_price_amount: 60_000, name_snapshot: 'Product A', clientPrice: 1 },
      { commerce_item_id: 'mentoring-a', unit_price_amount: 40_000, discounted_unit_price_amount: 40_000, name_snapshot: 'Mentoring', clientPrice: 1 },
    ],
  }
  const items = buildTrustedMidtransItems(order as never)
  assert.deepEqual(items.map(item => item.price), [60_000, 40_000])
  assert.equal(items.reduce((sum, item) => sum + item.price * item.quantity, 0), order.total_amount)
  assert.ok(items.every(item => !('clientPrice' in item)))
})

test('trusted Midtrans item construction rejects any Order/item total mismatch', () => {
  assert.throws(() => buildTrustedMidtransItems({
    total_amount: 90_000,
    items: [
      { commerce_item_id: 'product-a', unit_price_amount: 100_000, discounted_unit_price_amount: 80_000, name_snapshot: 'Product A' },
    ],
  } as never), /Order Item total does not match Order total/)
})
