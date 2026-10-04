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
  transactionTime: string | null
  settlementTime: string | null
  providerSuccessAt: string | null
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

function validateCalendarParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  field: string,
) {
  if (
    month < 1 || month > 12
    || day < 1 || day > 31
    || hour < 0 || hour > 23
    || minute < 0 || minute > 59
    || second < 0 || second > 59
  ) throw new Error(`Midtrans response has invalid ${field}.`)

  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
    || check.getUTCHours() !== hour
    || check.getUTCMinutes() !== minute
    || check.getUTCSeconds() !== second
  ) throw new Error(`Midtrans response has invalid ${field}.`)
}

function parseMidtransTimestamp(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`Midtrans response has invalid ${field}.`)

  const jakarta = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (jakarta) {
    const [year, month, day, hour, minute, second] = jakarta.slice(1).map(Number)
    validateCalendarParts(year, month, day, hour, minute, second, field)
    const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - 7 * 60 * 60 * 1000
    return new Date(utcMillis).toISOString()
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:?\d{2})$/.exec(value)
  if (!iso) throw new Error(`Midtrans response has invalid ${field}.`)

  const [year, month, day, hour, minute, second] = iso.slice(1, 7).map(Number)
  validateCalendarParts(year, month, day, hour, minute, second, field)
  const zone = iso[8] === 'Z' || iso[8].includes(':')
    ? iso[8]
    : `${iso[8].slice(0, 3)}:${iso[8].slice(3)}`
  const normalized = `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6]}${iso[7] ? `.${iso[7]}` : ''}${zone}`
  const millis = Date.parse(normalized)
  if (!Number.isFinite(millis)) throw new Error(`Midtrans response has invalid ${field}.`)
  return new Date(millis).toISOString()
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

function formatMidtransJakartaTime(timestamp: number) {
  const date = new Date(timestamp + 7 * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0700`
}

function buildBoundedPaymentExpiry(expiresAt: string, now = Date.now()) {
  const deadline = Date.parse(expiresAt)
  if (!Number.isFinite(deadline)) throw new Error('Invalid trusted payment deadline.')

  // Midtrans page_expiry is relative to provider token creation. Reserve the full
  // HTTP timeout so even a slow successful request cannot extend beyond our deadline.
  const durationMinutes = Math.floor((deadline - now - MIDTRANS_REQUEST_TIMEOUT_MS) / 60_000)
  if (durationMinutes < 5) throw new Error('Discounted Order payment window is too close to expiry. Create a new checkout.')

  return {
    durationMinutes,
    startTime: formatMidtransJakartaTime(now),
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
  paymentExpiresAt?: string | null
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

  const boundedExpiry = input.paymentExpiresAt
    ? buildBoundedPaymentExpiry(input.paymentExpiresAt)
    : null

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
      ...(boundedExpiry ? {
        expiry: {
          start_time: boundedExpiry.startTime,
          duration: boundedExpiry.durationMinutes,
          unit: 'minute',
        },
        page_expiry: {
          duration: boundedExpiry.durationMinutes,
          unit: 'minute',
        },
      } : {
        page_expiry: {
          duration: 24,
          unit: 'hour',
        },
      }),
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
  const transactionTime = parseMidtransTimestamp(payload.transaction_time, 'transaction_time')
  const settlementTime = parseMidtransTimestamp(payload.settlement_time, 'settlement_time')
  const normalizedStatus = normalizeMidtransStatus(statusCode, transactionStatus, fraudStatus)
  parseIdrGrossAmount(grossAmount)

  // Midtrans documents settlement_time as the moment a transaction becomes
  // settlement. A successful capture has no separate capture_time in the Core
  // API, so its transaction_time is the provider timestamp for that successful
  // capture record. Never substitute webhook receipt time for either value.
  const providerSuccessAt = normalizedStatus === 'paid'
    ? transactionStatus === 'settlement'
      ? settlementTime
      : transactionStatus === 'capture'
        ? transactionTime
        : null
    : null

  return {
    orderId,
    statusCode,
    grossAmount,
    transactionStatus,
    transactionId: optionalString(payload.transaction_id, 'transaction_id'),
    fraudStatus,
    paymentType: optionalString(payload.payment_type, 'payment_type'),
    signatureKey: optionalString(payload.signature_key, 'signature_key'),
    transactionTime,
    settlementTime,
    providerSuccessAt,
    normalizedStatus,
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
