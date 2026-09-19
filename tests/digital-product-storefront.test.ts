import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { getMarketingNavigation } from '../lib/content/marketing-content'
import { isDigitalProductsEnabled } from '../lib/features'

test('Digital Product rollout stays off unless the server value is exactly true', () => {
  assert.equal(isDigitalProductsEnabled(undefined), false)
  assert.equal(isDigitalProductsEnabled('false'), false)
  assert.equal(isDigitalProductsEnabled('TRUE'), false)
  assert.equal(isDigitalProductsEnabled('true'), true)
})

test('marketing navigation includes the storefront only when enabled by the server', () => {
  assert.equal(getMarketingNavigation(false).some(item => item.href === '/produk-digital'), false)
  assert.equal(getMarketingNavigation(true).some(item => item.href === '/produk-digital'), true)
})

test('public directory and detail consume real Digital Product records', () => {
  const directory = readFileSync('app/produk-digital/page.tsx', 'utf8')
  const detail = readFileSync('app/produk-digital/[slug]/page.tsx', 'utf8')
  const addToCart = readFileSync('components/digital-products/add-to-cart-button.tsx', 'utf8')

  assert.match(directory, /listPublicDigitalProducts/)
  assert.match(directory, /formatRupiah\(product\.price_amount\)/)
  assert.match(directory, /href=\{`\/produk-digital\/\$\{product\.slug\}`\}/)
  assert.doesNotMatch(directory, /productPlaceholders/)
  assert.match(detail, /getPublicDigitalProduct/)
  assert.match(detail, /AddToCartButton/)
  assert.doesNotMatch(detail, /PDF|video|download|file format/i)
  assert.match(addToCart, /Tambahkan ke Keranjang/)
  assert.match(addToCart, /rpc\('add_cart_item'/)
  assert.match(addToCart, /href="\/auth"/)
})

test('public Digital Product queries explicitly exclude drafts for every authenticated role', () => {
  const server = readFileSync('lib/commerce/server.ts', 'utf8')
  const publishedFilters = server.match(/\.eq\('is_published', true\)/g) ?? []
  assert.equal(publishedFilters.length, 3)
})
