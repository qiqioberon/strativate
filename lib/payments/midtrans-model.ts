import { createHash, timingSafeEqual } from 'node:crypto'

export type NormalizedPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'

export function normalizeMidtransStatus(
  statusCode: string,
  transactionStatus: string,
  fraudStatus: string | null,
): NormalizedPaymentStatus {
  switch (transactionStatus) {
    case 'settlement':
      return statusCode === '200' ? 'paid' : 'pending'
    case 'capture':
      if (fraudStatus === 'deny') return 'failed'
      if (statusCode === '200' && fraudStatus === 'accept') return 'paid'
      return 'pending'
    case 'deny':
      return 'failed'
    case 'cancel':
      return 'cancelled'
    case 'expire':
      return 'expired'
    case 'pending':
    default:
      return 'pending'
  }
}

export function toMidtransItemName(name: string): string {
  const normalized = name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\|/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized || !/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(normalized)) return 'Item Strativate'
  return Array.from(normalized).slice(0, 50).join('').trimEnd() || 'Item Strativate'
}

export function createMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
) {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`, 'utf8')
    .digest('hex')
}

export function verifyMidtransSignature(
  signature: string,
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
) {
  const expected = createMidtransSignature(orderId, statusCode, grossAmount, serverKey)
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false
  const actualBuffer = Buffer.from(signature.toLowerCase(), 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function parseIdrGrossAmount(value: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.00)?$/.exec(value)
  if (!match) throw new Error('Invalid Midtrans gross_amount for IDR.')
  return BigInt(match[1])
}
