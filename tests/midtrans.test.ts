import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMidtransSignature,
  normalizeMidtransStatus,
  parseIdrGrossAmount,
} from '../lib/payments/midtrans-model'

test('Midtrans status mapping never treats unsafe capture as paid', () => {
  assert.equal(normalizeMidtransStatus('pending', null), 'pending')
  assert.equal(normalizeMidtransStatus('settlement', null), 'paid')
  assert.equal(normalizeMidtransStatus('capture', 'accept'), 'paid')
  assert.equal(normalizeMidtransStatus('capture', 'challenge'), 'pending')
  assert.equal(normalizeMidtransStatus('capture', 'deny'), 'failed')
  assert.equal(normalizeMidtransStatus('deny', null), 'failed')
  assert.equal(normalizeMidtransStatus('cancel', null), 'cancelled')
  assert.equal(normalizeMidtransStatus('expire', null), 'expired')
  assert.equal(normalizeMidtransStatus('unexpected', null), 'pending')
})

test('signature uses exact notification strings in Midtrans order', () => {
  assert.equal(
    createMidtransSignature('ORDER-1', '200', '125000.00', 'server-secret'),
    '26aa6923818cab8702fbb07de560318d1e632e4572ac2a3e4302162bf364d1747a649b5bc87dc25b2486c38439991976e30d58bb2c29a5f330cbe1da768be2ab',
  )
})

test('gross amount parsing is integer-safe and rejects non-IDR fractions', () => {
  assert.equal(parseIdrGrossAmount('125000.00'), 125000n)
  assert.equal(parseIdrGrossAmount('0'), 0n)
  assert.throws(() => parseIdrGrossAmount('10.50'))
  assert.throws(() => parseIdrGrossAmount('1e5'))
})
