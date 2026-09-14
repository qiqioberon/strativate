import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const application = readFileSync('lib/payments/application.ts', 'utf8')
const startRoute = readFileSync('app/api/checkout/start/route.ts', 'utf8')
const statusRoute = readFileSync('app/api/checkout/status/route.ts', 'utf8')
const webhookRoute = readFileSync('app/api/payments/midtrans/webhook/route.ts', 'utf8')

test('checkout start uses trusted Order snapshots and one-owner Snap creation claims', () => {
  assert.match(application, /reserve_midtrans_payment_attempt/)
  assert.match(application, /claim_midtrans_snap_creation/)
  assert.match(application, /createMidtransSnapTransaction/)
  assert.match(application, /order\.total_amount/)
  assert.match(application, /item\.unit_price_amount/)
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
