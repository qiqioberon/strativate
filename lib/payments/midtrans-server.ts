import {
  normalizeMidtransStatus,
  parseIdrGrossAmount,
  toMidtransItemName,
  verifyMidtransSignature,
  type NormalizedPaymentStatus,
} from './midtrans-model'

export type MidtransEnvironment = 'sandbox' | 'production'

export type MidtransItem = {
  id: string
  price: number
  quantity: 1
  name: string
}

export type MidtransCustomer = {
  email: string
  firstName?: string
  lastName?: string
}

export type MidtransStatus = {
  orderId: string
  statusCode: string
  grossAmount: string
  transactionStatus: string
  transactionId: string | null
  fraudStatus: string | null
  paymentType: string | null
  signatureKey: string | null
  normalizedStatus: NormalizedPaymentStatus
}

type MidtransConfig = {
  environment: MidtransEnvironment
  snapTransactionUrl: string
  statusBaseUrl: string
  snapScriptUrl: string
  serverKey: string
}

const MIDTRANS_REQUEST_TIMEOUT_MS = 10_000

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Midtrans response is missing ${field}.`)
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`Midtrans response has invalid ${field}.`)
  return value
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Midtrans returned an invalid response.')
  return value as Record<string, unknown>
}

export function getMidtransPublicConfig() {
  const environment = readEnvironment()
  return {
    environment,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '',
    snapScriptUrl: environment === 'production'
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
  }
}

function readEnvironment(): MidtransEnvironment {
  const environment = process.env.MIDTRANS_ENV ?? 'sandbox'
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error('MIDTRANS_ENV must be sandbox or production.')
  }
  return environment
}

function getConfig(): MidtransConfig {
  const environment = readEnvironment()
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) throw new Error('Midtrans server configuration is missing.')
  return {
    environment,
    serverKey,
    snapTransactionUrl: environment === 'production'
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    statusBaseUrl: environment === 'production'
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2',
    snapScriptUrl: environment === 'production'
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
  }
}

function authorization(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`, 'utf8').toString('base64')}`
}

async function midtransFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(MIDTRANS_REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new Error('Midtrans request could not be completed.')
  }
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Midtrans returned a non-JSON response.')
  }
  const record = asRecord(payload)
  if (!response.ok) {
    const messages = Array.isArray(record.error_messages)
      ? record.error_messages.filter((item): item is string => typeof item === 'string').join('; ')
      : ''
    throw new Error(messages ? `Midtrans request failed: ${messages}` : `Midtrans request failed with HTTP ${response.status}.`)
  }
  return record
}

export async function createMidtransSnapTransaction(input: {
  providerOrderId: string
  grossAmount: number
  items: MidtransItem[]
  customer: MidtransCustomer
}) {
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) throw new Error('Invalid trusted Order total.')
  if (!input.providerOrderId || input.providerOrderId.length > 49) throw new Error('Invalid Midtrans provider order ID.')
  if (!input.items.length) throw new Error('Midtrans payment requires at least one Order Item.')

  const itemTotal = input.items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.price) || item.price < 0 || item.quantity !== 1) throw new Error('Invalid trusted Order Item price.')
    if (!item.id || !item.name) throw new Error('Invalid trusted Order Item snapshot.')
    return sum + item.price
  }, 0)
  if (itemTotal !== input.grossAmount) throw new Error('Order Item total does not match Order total.')

  const config = getConfig()
  const response = await midtransFetch(config.snapTransactionUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: authorization(config.serverKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.providerOrderId,
        gross_amount: input.grossAmount,
      },
      item_details: input.items.map(item => ({
        id: item.id,
        price: item.price,
        quantity: 1,
        name: toMidtransItemName(item.name),
      })),
      customer_details: {
        email: input.customer.email,
        ...(input.customer.firstName ? { first_name: input.customer.firstName } : {}),
        ...(input.customer.lastName ? { last_name: input.customer.lastName } : {}),
      },
      page_expiry: {
        duration: 24,
        unit: 'hour',
      },
    }),
    cache: 'no-store',
  })
  const payload = await parseJson(response)
  return { token: requiredString(payload.token, 'token') }
}

function parseStatusRecord(payload: Record<string, unknown>): MidtransStatus {
  const orderId = requiredString(payload.order_id, 'order_id')
  const statusCode = requiredString(payload.status_code, 'status_code')
  const grossAmount = requiredString(payload.gross_amount, 'gross_amount')
  const transactionStatus = requiredString(payload.transaction_status, 'transaction_status')
  const fraudStatus = optionalString(payload.fraud_status, 'fraud_status')
  parseIdrGrossAmount(grossAmount)
  return {
    orderId,
    statusCode,
    grossAmount,
    transactionStatus,
    transactionId: optionalString(payload.transaction_id, 'transaction_id'),
    fraudStatus,
    paymentType: optionalString(payload.payment_type, 'payment_type'),
    signatureKey: optionalString(payload.signature_key, 'signature_key'),
    normalizedStatus: normalizeMidtransStatus(statusCode, transactionStatus, fraudStatus),
  }
}

export async function getMidtransTransactionStatus(providerOrderId: string): Promise<MidtransStatus> {
  if (!providerOrderId) throw new Error('Midtrans provider order ID is required.')
  const config = getConfig()
  const response = await midtransFetch(`${config.statusBaseUrl}/${encodeURIComponent(providerOrderId)}/status`, {
    headers: {
      Accept: 'application/json',
      Authorization: authorization(config.serverKey),
    },
    cache: 'no-store',
  })
  return parseStatusRecord(await parseJson(response))
}

export function parseAndVerifyMidtransNotification(payload: unknown): MidtransStatus {
  const record = asRecord(payload)
  const status = parseStatusRecord(record)
  const signature = requiredString(record.signature_key, 'signature_key')
  const config = getConfig()
  if (!verifyMidtransSignature(
    signature,
    status.orderId,
    status.statusCode,
    status.grossAmount,
    config.serverKey,
  )) {
    throw new Error('Invalid Midtrans notification signature.')
  }
  return { ...status, signatureKey: signature }
}
