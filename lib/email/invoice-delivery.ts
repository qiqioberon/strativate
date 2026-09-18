import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { sendTransactionalEmail } from './email-client'
import { renderPaidInvoiceEmail, type PaidInvoiceEmailPayload } from './templates'

type RpcError = { message: string }
type RpcClient = {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>
}
type DeliveryRow = {
  id: string
  recipient_email: string
  recipient_name: string | null
  idempotency_key: string
  payload: PaidInvoiceEmailPayload
}

export async function deliverPaidInvoiceForOrder(orderId: string) {
  const admin = createAdminClient() as unknown as RpcClient
  const ensured = await admin.rpc<string>('ensure_paid_invoice_delivery', { p_order_id: orderId })
  if (ensured.error) throw new Error('invoice-outbox-unavailable')

  const claimed = await admin.rpc<DeliveryRow[]>('claim_paid_invoice_delivery', { p_order_id: orderId })
  if (claimed.error) throw new Error('invoice-outbox-claim-failed')

  const delivery = claimed.data?.[0]
  if (!delivery) return { status: 'noop' as const }

  try {
    const appUrl = process.env.APP_URL
    if (!appUrl || !/^https?:\/\//.test(appUrl)) throw new Error('app-url-not-configured')

    const rendered = renderPaidInvoiceEmail(delivery.payload, appUrl)
    await sendTransactionalEmail({
      to: delivery.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: delivery.idempotency_key,
    })

    const completed = await admin.rpc('complete_paid_invoice_delivery', {
      p_delivery_id: delivery.id,
      p_sent: true,
      p_error: null,
    })
    if (completed.error) throw new Error('invoice-outbox-complete-failed')

    return { status: 'sent' as const }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invoice-delivery-failed'
    await admin.rpc('complete_paid_invoice_delivery', {
      p_delivery_id: delivery.id,
      p_sent: false,
      p_error: code,
    })
    console.error('Paid invoice email delivery failed.', { orderId, code })
    return { status: 'failed' as const }
  }
}


type DueOrder = { order_id: string }

export async function drainPaidInvoiceOutbox(limit = 20) {
  const admin = createAdminClient() as unknown as RpcClient
  const due = await admin.rpc<DueOrder[]>('list_due_paid_invoice_orders', { p_limit: limit })
  if (due.error) throw new Error('invoice-outbox-list-failed')

  const result = { attempted: 0, sent: 0, failed: 0, noop: 0 }
  for (const row of due.data ?? []) {
    result.attempted += 1
    const delivery = await deliverPaidInvoiceForOrder(row.order_id)
    if (delivery.status === 'sent') result.sent += 1
    else if (delivery.status === 'failed') result.failed += 1
    else result.noop += 1
  }
  return result
}
