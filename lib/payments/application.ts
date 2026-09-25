import 'server-only'

import { randomUUID } from 'node:crypto'

import { getOrderWithItems } from '@/lib/commerce/server'
import type { OrderWithItems } from '@/lib/commerce/types'
import type { PaymentAttempt } from '@/lib/supabase/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { deliverPaidInvoiceForOrder } from '@/lib/email/invoice-delivery'

import {
  createMidtransSnapTransaction,
  getMidtransTransactionStatus,
  parseAndVerifyMidtransNotification,
  type MidtransStatus,
} from './midtrans'
import { parseIdrGrossAmount } from './midtrans-model'
import type { SanitizedCheckout } from './types'

export type CheckoutCustomer = {
  email: string
  firstName?: string
  lastName?: string
}

const SNAP_CREATION_POLL_INTERVAL_MS = 200
const SNAP_CREATION_POLL_ATTEMPTS = 10

function hasValidSnapToken(attempt: PaymentAttempt, now = Date.now()) {
  if (!attempt.snap_token || !attempt.snap_token_expires_at) return false
  const expiresAt = Date.parse(attempt.snap_token_expires_at)
  return Number.isFinite(expiresAt) && expiresAt > now
}

function sanitize(order: OrderWithItems, attempt: PaymentAttempt | null): SanitizedCheckout {
  return {
    order: {
      id: order.id,
      status: order.status,
      currencyCode: order.currency_code,
      totalAmount: order.total_amount,
      paidAt: order.paid_at,
    },
    items: order.items.map(item => ({
      id: item.id,
      kind: item.item_kind_snapshot,
      name: item.name_snapshot,
      slug: item.slug_snapshot,
      unitPriceAmount: item.discounted_unit_price_amount ?? item.unit_price_amount,
    })),
    payment: attempt ? {
      attemptId: attempt.id,
      status: attempt.status,
      snapToken: hasValidSnapToken(attempt) ? attempt.snap_token : null,
    } : null,
  }
}

function assertAmountMatches(expected: number, providerAmount: string) {
  if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('Invalid trusted Order amount.')
  if (parseIdrGrossAmount(providerAmount) !== BigInt(expected)) {
    throw new Error('Midtrans amount does not match the trusted Order amount.')
  }
}

function assertOrderTotal(order: OrderWithItems) {
  if (!Number.isSafeInteger(order.total_amount) || order.total_amount <= 0) {
    throw new Error('Order total is not eligible for Midtrans checkout.')
  }
  const itemTotal = order.items.reduce((total, item) => {
    const trustedPrice = item.discounted_unit_price_amount ?? item.unit_price_amount
    if (!Number.isSafeInteger(trustedPrice) || trustedPrice < 0) {
      throw new Error('Order Item contains an invalid trusted price.')
    }
    return total + trustedPrice
  }, 0)
  if (!Number.isSafeInteger(itemTotal) || itemTotal !== order.total_amount) {
    throw new Error('Order Item total does not match Order total.')
  }
}

async function applyProviderStatus(attempt: PaymentAttempt, status: MidtransStatus) {
  if (status.orderId !== attempt.provider_order_id) throw new Error('Midtrans provider order ID does not match Payment Attempt.')
  assertAmountMatches(attempt.gross_amount, status.grossAmount)

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('apply_midtrans_payment_status', {
    p_attempt_id: attempt.id,
    p_normalized_status: status.normalizedStatus,
    p_provider_status: status.transactionStatus,
    p_provider_transaction_id: status.transactionId,
    p_fraud_status: status.fraudStatus,
    p_payment_type: status.paymentType,
  })
  if (error || !data) throw new Error('Payment status could not be applied.')
  if (status.normalizedStatus === 'paid') {
    try {
      await deliverPaidInvoiceForOrder(attempt.order_id)
    } catch (error) {
      console.error('Paid invoice delivery could not be started.', {
        orderId: attempt.order_id,
        code: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
  return data
}

async function loadAttempt(attemptId: string): Promise<PaymentAttempt | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payment_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle()
  if (error) throw new Error('Payment Attempt could not be loaded.')
  return data
}

async function waitForCreatedSnapToken(attemptId: string): Promise<PaymentAttempt | null> {
  for (let index = 0; index < SNAP_CREATION_POLL_ATTEMPTS; index += 1) {
    await new Promise(resolve => setTimeout(resolve, SNAP_CREATION_POLL_INTERVAL_MS))
    const attempt = await loadAttempt(attemptId)
    if (!attempt) return null
    if (hasValidSnapToken(attempt)) return attempt
    if (!['creating', 'pending'].includes(attempt.status)) return attempt
  }
  return loadAttempt(attemptId)
}

export async function startOwnedOrderPayment(orderId: string, customer: CheckoutCustomer): Promise<SanitizedCheckout> {
  if (!customer.email) throw new Error('Authenticated customer email is required.')
  const order = await getOrderWithItems(orderId)
  if (order.status === 'paid') throw new Error('Order is already paid.')
  if (!order.items.length) throw new Error('Order has no items.')
  assertOrderTotal(order)

  const admin = createAdminClient()
  const { data: reserved, error: reserveError } = await admin.rpc('reserve_midtrans_payment_attempt', {
    p_order_id: order.id,
  })
  if (reserveError || !reserved) throw new Error('Payment Attempt could not be reserved.')
  if (reserved.gross_amount !== order.total_amount) throw new Error('Payment Attempt amount does not match Order total.')

  if (hasValidSnapToken(reserved)) return sanitize(order, reserved)

  const claimToken = randomUUID()
  const { data: ownsCreation, error: claimError } = await admin.rpc('claim_midtrans_snap_creation', {
    p_attempt_id: reserved.id,
    p_claim_token: claimToken,
  })
  if (claimError) throw new Error('Payment initialization could not be claimed.')

  if (!ownsCreation) {
    const completed = await waitForCreatedSnapToken(reserved.id)
    if (completed && hasValidSnapToken(completed)) return sanitize(order, completed)
    throw new Error('Payment initialization is already in progress. Please retry.')
  }

  let snap: { token: string }
  try {
    snap = await createMidtransSnapTransaction({
      providerOrderId: reserved.provider_order_id,
      grossAmount: order.total_amount,
      items: order.items.map(item => ({
        id: item.commerce_item_id,
        price: item.unit_price_amount,
        quantity: 1,
        name: item.name_snapshot,
      })),
      customer,
    })
  } catch {
    await admin.rpc('release_midtrans_snap_creation', {
      p_attempt_id: reserved.id,
      p_claim_token: claimToken,
    })
    throw new Error('Payment provider could not be initialized.')
  }

  const { data: stored, error: storeError } = await admin.rpc('store_midtrans_snap_token', {
    p_attempt_id: reserved.id,
    p_claim_token: claimToken,
    p_snap_token: snap.token,
  })
  if (storeError || !stored) throw new Error('Snap token could not be persisted.')
  return sanitize(order, stored)
}

async function latestAttemptForOrder(orderId: string): Promise<PaymentAttempt | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payment_attempts')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Payment Attempt could not be loaded.')
  return data
}

export async function reconcileOwnedOrderPayment(orderId: string): Promise<SanitizedCheckout> {
  const ownedOrder = await getOrderWithItems(orderId)
  const attempt = await latestAttemptForOrder(ownedOrder.id)
  if (!attempt) return sanitize(ownedOrder, null)
  if (attempt.status === 'creating' && !attempt.snap_token) return sanitize(ownedOrder, attempt)

  const providerStatus = await getMidtransTransactionStatus(attempt.provider_order_id)
  const applied = await applyProviderStatus(attempt, providerStatus)
  const refreshedOrder = await getOrderWithItems(ownedOrder.id)
  return sanitize(refreshedOrder, applied)
}

export async function reconcileMidtransWebhook(payload: unknown) {
  const providerStatus = parseAndVerifyMidtransNotification(payload)
  const admin = createAdminClient()

  const { data: attempt, error: attemptError } = await admin
    .from('payment_attempts')
    .select('*')
    .eq('provider_order_id', providerStatus.orderId)
    .maybeSingle()
  if (attemptError || !attempt) throw new Error('Unknown Midtrans provider_order_id.')

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*')
    .eq('id', attempt.order_id)
    .maybeSingle()
  if (orderError || !order) throw new Error('Order for Payment Attempt was not found.')

  assertAmountMatches(order.total_amount, providerStatus.grossAmount)
  if (attempt.gross_amount !== order.total_amount) throw new Error('Payment Attempt amount does not match Order total.')

  const applied = await applyProviderStatus(attempt, providerStatus)
  return {
    orderId: order.id,
    orderStatus: providerStatus.normalizedStatus === 'paid' ? 'paid' : order.status,
    paymentStatus: applied.status,
  }
}
