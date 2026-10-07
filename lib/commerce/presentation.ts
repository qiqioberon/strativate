import type { OrderWithItems } from './types'
import { menteeMentoringName } from '@/lib/mentoring-presentation'

export type CommerceLanguage = 'id' | 'en'

export function commerceItemName(name: string, language: CommerceLanguage = 'id') {
  return language === 'en' ? menteeMentoringName(name) : name
}

export function commerceItemLabel(kind: string, language: CommerceLanguage = 'id') {
  if (kind === 'digital_product') return language === 'en' ? 'Digital Product' : 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  if (kind === 'intensive_mentoring_custom_offer') return language === 'en' ? 'International Intensive offer' : 'Penawaran Intensive Internasional'
  if (kind.startsWith('intensive_mentoring_') || kind === 'intensive_mentoring') return 'Intensive Mentoring'
  return 'Item'
}

export function commerceOrderStatus(status: OrderWithItems['status'], language: CommerceLanguage = 'id') {
  const labels: Record<OrderWithItems['status'], [string, string]> = {
    pending_payment: ['Pending payment', 'Menunggu pembayaran'],
    paid: ['Paid', 'Lunas'],
    payment_failed: ['Payment failed', 'Pembayaran gagal'],
    expired: ['Expired', 'Kedaluwarsa'],
    cancelled: ['Cancelled', 'Dibatalkan'],
  }
  return (labels[status] ?? labels.cancelled)[language === 'en' ? 0 : 1]
}

export function commerceDiscountError(message: string | undefined, language: CommerceLanguage = 'id') {
  const en = language === 'en'
  if (message?.includes('redemption limit')) return en ? 'This discount code has reached its usage limit.' : 'Kode diskon sudah mencapai batas penggunaan.'
  if (message?.includes('not compatible')) return en ? 'This discount code does not apply to the items in your cart.' : 'Kode diskon tidak berlaku untuk item di keranjang ini.'
  if (message?.includes('subtotal does not meet')) return en ? 'Eligible items do not meet the minimum subtotal for this code.' : 'Subtotal item yang memenuhi syarat belum mencapai minimum kode diskon.'
  if (message?.includes('already applied')) return en ? 'This discount code is already applied.' : 'Kode diskon ini sudah digunakan.'
  return en ? 'This discount code is invalid or has expired.' : 'Kode diskon tidak valid atau sudah kedaluwarsa.'
}
