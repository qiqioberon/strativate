import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export type CreatedCartLink = { id: string; url: string }

export function hashCartLinkToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function createAdminCartLink(menteeId: string, commerceItemIds: string[], origin: string, competition?: { categoryId?: string | null; name?: string | null }): Promise<CreatedCartLink> {
  if (!menteeId || commerceItemIds.length === 0) throw new Error('Pilih mentee dan minimal satu item.')
  const uniqueItemIds = [...new Set(commerceItemIds)]
  if (uniqueItemIds.length !== commerceItemIds.length) throw new Error('Item Cart Link tidak boleh duplikat.')

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashCartLinkToken(rawToken)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_commerce_cart_link_with_context', {
    p_mentee_id: menteeId,
    p_token_hash: tokenHash,
    p_commerce_item_ids: uniqueItemIds,
    p_competition_category_id: competition?.categoryId || null,
    p_competition_name: competition?.name?.trim() || null,
  })
  if (error?.message?.includes('Digital product already owned')) {
    throw new Error('Produk digital yang sudah dimiliki mentee tidak dapat ditambahkan ke Cart Link.')
  }
  if (error || !data) throw new Error(error?.message || 'Cart Link belum dapat dibuat. Periksa mentee dan ketersediaan item.')

  return { id: data, url: `${origin.replace(/\/$/, '')}/cart-link/${rawToken}` }
}
