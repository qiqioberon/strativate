import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMidtransSignature,
  normalizeMidtransStatus,
  parseIdrGrossAmount,
  toMidtransItemName,
} from '../lib/payments/midtrans-model'

test('Midtrans status mapping requires provider success code before paid', () => {
  assert.equal(normalizeMidtransStatus('200', 'pending', null), 'pending')
  assert.equal(normalizeMidtransStatus('200', 'settlement', null), 'paid')
  assert.equal(normalizeMidtransStatus('201', 'settlement', null), 'pending')
  assert.equal(normalizeMidtransStatus('500', 'settlement', null), 'pending')
  assert.equal(normalizeMidtransStatus('200', 'capture', 'accept'), 'paid')
  assert.equal(normalizeMidtransStatus('201', 'capture', 'accept'), 'pending')
  assert.equal(normalizeMidtransStatus('200', 'capture', null), 'pending')
  assert.equal(normalizeMidtransStatus('200', 'capture', 'challenge'), 'pending')
  assert.equal(normalizeMidtransStatus('200', 'capture', 'deny'), 'failed')
  assert.equal(normalizeMidtransStatus('200', 'deny', null), 'failed')
  assert.equal(normalizeMidtransStatus('200', 'cancel', null), 'cancelled')
  assert.equal(normalizeMidtransStatus('200', 'expire', null), 'expired')
  assert.equal(normalizeMidtransStatus('200', 'unexpected', null), 'pending')
})

test('Midtrans item names are provider-safe without breaking Unicode', () => {
  assert.equal(toMidtransItemName('A'.repeat(50)), 'A'.repeat(50))
  assert.equal(toMidtransItemName('A'.repeat(51)), 'A'.repeat(50))
  const unicode = toMidtransItemName('😀'.repeat(60))
  assert.equal(Array.from(unicode).length, 50)
  assert.equal(unicode, '😀'.repeat(50))
  assert.equal(toMidtransItemName('  Business|Case\u0000\n  Guide  '), 'Business - Case Guide')
  assert.equal(toMidtransItemName('\u0000|\n'), 'Item Strativate')
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
