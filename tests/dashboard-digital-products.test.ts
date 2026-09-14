import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/dashboard/page.tsx', 'utf8')
const client = readFileSync('app/dashboard/dashboard-client.tsx', 'utf8')

test('dashboard loads paid Digital Product ownership from Shared Commerce', () => {
  assert.match(page, /listOwnedDigitalProducts\(\)/)
  assert.match(page, /isDigitalProductsEnabled\(\)/)
  assert.match(client, /name_snapshot/)
  assert.match(client, /purchased_at/)
  assert.match(client, /unit_price_amount/)
})

test('Digital Product library has no LocalStorage purchase source or fake file action', () => {
  const librarySource = client.slice(client.indexOf('function DigitalProductLibrary'))
  assert.doesNotMatch(librarySource, /digitalPurchases/)
  assert.doesNotMatch(librarySource, /Buka di pustaka|Download|Open PDF|Watch|Play Video/i)
})
