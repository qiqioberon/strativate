import assert from 'node:assert/strict'
import test from 'node:test'

import { summarizeCart } from '../lib/commerce/model'
import { formatRupiah } from '../lib/commerce/money'

test('Rupiah formatter rejects unsafe amounts instead of rounding transaction money', () => {
  assert.equal(formatRupiah(0), 'Rp0')
  assert.equal(formatRupiah(75_000), 'Rp75.000')
  assert.throws(() => formatRupiah(1.5), /safe integer/i)
  assert.throws(() => formatRupiah(-1), /non-negative/i)
  assert.throws(() => formatRupiah(Number.MAX_SAFE_INTEGER + 1), /safe integer/i)
})

test('Cart summary totals current available rows and blocks checkout when one source is unavailable', () => {
  const cart = summarizeCart('cart-1', [
    {
      cart_id: 'cart-1',
      cart_item_id: 'item-1',
      commerce_item_id: 'product-1',
      item_kind: 'digital_product',
      name: 'Business Case Handbook',
      slug: 'business-case-handbook',
      image_path: 'products/business-case-handbook.webp',
      price_amount: 75_000,
      is_available: true,
      created_at: '2026-09-14T00:00:00.000Z',
    },
    {
      cart_id: 'cart-1',
      cart_item_id: 'item-2',
      commerce_item_id: 'product-2',
      item_kind: 'digital_product',
      name: null,
      slug: null,
      image_path: null,
      price_amount: null,
      is_available: false,
      created_at: '2026-09-14T00:01:00.000Z',
    },
  ])

  assert.equal(cart.totalAmount, 75_000)
  assert.equal(cart.hasUnavailableItems, true)
  assert.equal(cart.canCheckout, false)
  assert.equal(cart.items.length, 2)
})

test('Cart summary permits checkout only for a non-empty fully available Cart', () => {
  const row = {
    cart_id: 'cart-2',
    cart_item_id: 'item-3',
    commerce_item_id: 'product-3',
    item_kind: 'digital_product',
    name: 'Pitch Deck Workbook',
    slug: 'pitch-deck-workbook',
    image_path: 'products/pitch-deck-workbook.webp',
    price_amount: 50_000,
    is_available: true,
    created_at: '2026-09-14T00:00:00.000Z',
  }

  assert.equal(summarizeCart('cart-2', [row]).canCheckout, true)
  assert.equal(summarizeCart('cart-2', []).canCheckout, false)
})
