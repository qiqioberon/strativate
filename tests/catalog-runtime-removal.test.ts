import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('legacy catalog runtime and checkout compatibility are removed', () => {
  assert.equal(existsSync('lib/catalog'), false)
  assert.equal(existsSync('components/checkout/legacy-checkout.tsx'), false)
  assert.equal(existsSync('tests/catalog.test.ts'), false)

  const checkout = readFileSync('app/checkout/[slug]/page.tsx', 'utf8')
  assert.doesNotMatch(checkout, /@\/lib\/catalog|LegacyCheckout|featureFlags/)

  const demoStore = readFileSync('lib/demo-store.ts', 'utf8')
  assert.doesNotMatch(demoStore, /commercialItemId/)
})
