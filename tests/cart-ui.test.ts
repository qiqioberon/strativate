import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routes = readFileSync('lib/auth/routes.ts', 'utf8')
const page = readFileSync('app/cart/page.tsx', 'utf8')
const layout = readFileSync('app/cart/layout.tsx', 'utf8')
const view = readFileSync('components/commerce/cart-view.tsx', 'utf8')
const entry = readFileSync('components/commerce/cart-entry-link.tsx', 'utf8')

test('cart is a protected completed-Mentee application route', () => {
  assert.match(routes, /['"]\/cart['"]/)
  assert.match(layout, /requireAccount\(['"]\/dashboard['"]\)/)
  assert.match(page, /getActiveCart\(\)/)
})

test('cart renders shared commerce rows and blocks unavailable checkout', () => {
  assert.match(view, /item\.name/)
  assert.match(view, /formatRupiah\(item\.price_amount/)
  assert.match(view, /formatRupiah\(cart\.totalAmount\)/)
  assert.match(view, /remove_cart_item/)
  assert.match(view, /cart\.hasUnavailableItems/)
  assert.match(view, /checkoutActiveCart/)
  assert.match(view, /<form\s+action=\{checkoutActiveCart\}>/)
  assert.doesNotMatch(view, /href="\/checkout"/)
  assert.doesNotMatch(view, /quantity|kuantitas/i)
})

test('cart entry is compact and only rendered when the server says purchasing is allowed', () => {
  assert.match(entry, /showCart/)
  assert.match(entry, /href="\/cart"/)
})
