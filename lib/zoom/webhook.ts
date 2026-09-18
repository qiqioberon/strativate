import { createHmac, timingSafeEqual } from 'node:crypto'

function secret() {
  const value = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!value) throw new Error('Zoom webhook secret is not configured.')
  return value
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function zoomValidationToken(plainToken: string) {
  return createHmac('sha256', secret()).update(plainToken).digest('hex')
}

export function verifyZoomWebhook(rawBody: string, timestamp: string | null, signature: string | null) {
  if (!timestamp || !signature || !/^v0=[0-9a-f]{64}$/i.test(signature)) return false
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) return false
  const expected = 'v0=' + createHmac('sha256', secret()).update(`v0:${timestamp}:${rawBody}`).digest('hex')
  return safeEqual(expected, signature)
}
