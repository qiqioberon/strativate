import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateDiscountAmount,
  normalizeDiscountCode,
  resolveDiscountedTotal,
} from '../lib/commerce/discount'

test('discount codes normalize to an uppercase canonical value', () => {
  assert.equal(normalizeDiscountCode('  save-10 '), 'SAVE-10')
})

test('percentage discounts are capped at the subtotal and rounded down to whole IDR', () => {
  assert.equal(calculateDiscountAmount({ subtotal: 99_999, type: 'percentage', value: 15 }), 14_999)
  assert.equal(calculateDiscountAmount({ subtotal: 10_000, type: 'percentage', value: 150 }), 10_000)
})

test('fixed discounts are capped at the subtotal', () => {
  assert.equal(calculateDiscountAmount({ subtotal: 100_000, type: 'fixed', value: 25_000 }), 25_000)
  assert.equal(calculateDiscountAmount({ subtotal: 20_000, type: 'fixed', value: 25_000 }), 20_000)
})

test('resolved totals never become negative', () => {
  assert.deepEqual(resolveDiscountedTotal(100_000, 15_000), { subtotal: 100_000, discount: 15_000, total: 85_000 })
  assert.deepEqual(resolveDiscountedTotal(100_000, 120_000), { subtotal: 100_000, discount: 100_000, total: 0 })
})
