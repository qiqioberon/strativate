import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  createMidtransSnapTransaction,
  getMidtransTransactionStatus,
} from '../lib/payments/midtrans-server'

const originalFetch = globalThis.fetch
const originalEnvironment = process.env.MIDTRANS_ENV
const originalServerKey = process.env.MIDTRANS_SERVER_KEY

type CapturedRequest = { input: RequestInfo | URL; init?: RequestInit }

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalEnvironment === undefined) delete process.env.MIDTRANS_ENV
  else process.env.MIDTRANS_ENV = originalEnvironment
  if (originalServerKey === undefined) delete process.env.MIDTRANS_SERVER_KEY
  else process.env.MIDTRANS_SERVER_KEY = originalServerKey
})

function configure(environment: 'sandbox' | 'production' = 'sandbox') {
  process.env.MIDTRANS_ENV = environment
  process.env.MIDTRANS_SERVER_KEY = 'server-secret'
}

function snapInput() {
  return {
    providerOrderId: 'STV-ORDER-1',
    grossAmount: 125000,
    items: [
      {
        id: 'item-1',
        price: 125000,
        quantity: 1 as const,
        name: '  Business|Case\u0000 Ultimate Preparation Handbook '.repeat(2),
      },
    ],
    customer: {
      email: 'mentee@example.com',
      firstName: 'Mentee',
      lastName: 'Strativate',
    },
  }
}

test('create Snap uses sandbox URL, Basic Auth, trusted totals, safe item names, and explicit page expiry', async () => {
  configure('sandbox')
  const input = snapInput()
  const originalName = input.items[0].name
  const requests: CapturedRequest[] = []
  globalThis.fetch = (async (fetchInput, init) => {
    requests.push({ input: fetchInput, init })
    return new Response(JSON.stringify({ token: 'snap-token' }), { status: 201 })
  }) as typeof fetch

  const result = await createMidtransSnapTransaction(input)
  const request = requests[0]
  assert.ok(request)

  assert.deepEqual(result, { token: 'snap-token' })
  assert.equal(String(request.input), 'https://app.sandbox.midtrans.com/snap/v1/transactions')
  assert.equal(new Headers(request.init?.headers).get('Authorization'), `Basic ${Buffer.from('server-secret:').toString('base64')}`)
  assert.ok(request.init?.signal instanceof AbortSignal)
  const body = JSON.parse(String(request.init?.body)) as Record<string, unknown>
  assert.deepEqual(body.transaction_details, { order_id: 'STV-ORDER-1', gross_amount: 125000 })
  assert.deepEqual(body.page_expiry, { duration: 24, unit: 'hour' })
  const item = (body.item_details as Array<{ name: string; price: number; quantity: number }>)[0]
  assert.equal(item.price, 125000)
  assert.equal(item.quantity, 1)
  assert.ok(Array.from(item.name).length <= 50)
  assert.doesNotMatch(item.name, /[|\u0000-\u001f\u007f-\u009f]/)
  assert.equal(input.items[0].name, originalName)
  assert.doesNotMatch(JSON.stringify(result), /server-secret/)
})

test('create Snap switches to the production endpoint without changing auth semantics', async () => {
  configure('production')
  let url = ''
  globalThis.fetch = (async (fetchInput) => {
    url = String(fetchInput)
    return new Response(JSON.stringify({ token: 'production-token' }), { status: 201 })
  }) as typeof fetch

  assert.deepEqual(await createMidtransSnapTransaction(snapInput()), { token: 'production-token' })
  assert.equal(url, 'https://app.midtrans.com/snap/v1/transactions')
})

test('create Snap fails closed before fetch for mismatched or zero totals', async () => {
  configure()
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(JSON.stringify({ token: 'unexpected' }), { status: 201 })
  }) as typeof fetch

  const mismatch = snapInput()
  mismatch.grossAmount = 125001
  await assert.rejects(() => createMidtransSnapTransaction(mismatch), /does not match Order total/)

  const zero = snapInput()
  zero.grossAmount = 0
  zero.items[0].price = 0
  await assert.rejects(() => createMidtransSnapTransaction(zero), /Invalid trusted Order total/)
  assert.equal(calls, 0)
})

test('create Snap rejects provider 4xx, 5xx, malformed JSON, blank token, and network failure', async (t) => {
  configure()

  await t.test('4xx', async () => {
    configure()
    globalThis.fetch = (async () => new Response(JSON.stringify({ error_messages: ['bad request'] }), { status: 400 })) as typeof fetch
    await assert.rejects(() => createMidtransSnapTransaction(snapInput()), /Midtrans request failed/)
  })

  await t.test('5xx', async () => {
    configure()
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 503 })) as typeof fetch
    await assert.rejects(() => createMidtransSnapTransaction(snapInput()), /HTTP 503/)
  })

  await t.test('malformed JSON', async () => {
    configure()
    globalThis.fetch = (async () => new Response('not-json', { status: 201 })) as typeof fetch
    await assert.rejects(() => createMidtransSnapTransaction(snapInput()), /non-JSON/)
  })

  await t.test('blank token', async () => {
    configure()
    globalThis.fetch = (async () => new Response(JSON.stringify({ token: '   ' }), { status: 201 })) as typeof fetch
    await assert.rejects(() => createMidtransSnapTransaction(snapInput()), /missing token/)
  })

  await t.test('network failure', async () => {
    configure()
    globalThis.fetch = (async () => { throw new Error('socket included server-secret') }) as typeof fetch
    await assert.rejects(
      () => createMidtransSnapTransaction(snapInput()),
      (error: unknown) => error instanceof Error
        && /Midtrans request could not be completed/.test(error.message)
        && !error.message.includes('server-secret'),
    )
  })
})

test('Get Status validates provider shape and uses the same trusted status mapping', async () => {
  configure('sandbox')
  const requests: CapturedRequest[] = []
  globalThis.fetch = (async (fetchInput, init) => {
    requests.push({ input: fetchInput, init })
    return new Response(JSON.stringify({
      order_id: 'STV-ORDER-1',
      status_code: '200',
      gross_amount: '125000.00',
      transaction_status: 'settlement',
      transaction_id: 'provider-tx-1',
      payment_type: 'bank_transfer',
    }), { status: 200 })
  }) as typeof fetch

  const status = await getMidtransTransactionStatus('STV-ORDER-1')
  const request = requests[0]
  assert.ok(request)
  assert.equal(String(request.input), 'https://api.sandbox.midtrans.com/v2/STV-ORDER-1/status')
  assert.equal(new Headers(request.init?.headers).get('Authorization'), `Basic ${Buffer.from('server-secret:').toString('base64')}`)
  assert.ok(request.init?.signal instanceof AbortSignal)
  assert.equal(status.normalizedStatus, 'paid')
  assert.equal(status.transactionId, 'provider-tx-1')
})

test('Get Status rejects malformed provider responses', async () => {
  configure()
  globalThis.fetch = (async () => new Response(JSON.stringify({
    order_id: 'STV-ORDER-1',
    status_code: 200,
    gross_amount: '125000.00',
    transaction_status: 'settlement',
  }), { status: 200 })) as typeof fetch

  await assert.rejects(() => getMidtransTransactionStatus('STV-ORDER-1'), /status_code/)
})
