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
    '1cd9920d624fc6faac8c7ab0789bf12e786509e7a98dfe3eb177cc119a58a4e7a0488244e559173a416029dd75f58afd2410e8aa49c1e8585953a4130d184d1c',
  )
})

test('gross amount parsing is integer-safe and rejects non-IDR fractions', () => {
  assert.equal(parseIdrGrossAmount('125000.00'), BigInt(125000))
  assert.equal(parseIdrGrossAmount('0'), BigInt(0))
  assert.throws(() => parseIdrGrossAmount('10.50'))
  assert.throws(() => parseIdrGrossAmount('1e5'))
})
