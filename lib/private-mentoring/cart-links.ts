import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { adminFormError } from '@/lib/auth/errors'

export type CreatedCartLink = { id: string; url: string }

export function hashCartLinkToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export type PrivateCartLinkConfig={mode:'new_enrollment'|'top_up';mentorTierId:string;targetEnrollmentId:string|null;sessionCount:number;competitionCategoryId:string|null;competitionNames:string[]}

export async function createAdminCartLink(menteeId: string, commerceItemIds: string[], origin: string, privateConfig:PrivateCartLinkConfig|null=null): Promise<CreatedCartLink> {
  if (!menteeId || (commerceItemIds.length === 0&&!privateConfig)) throw new Error('Select a mentee and at least one item.')
  const uniqueItemIds = [...new Set(commerceItemIds)]
  if (uniqueItemIds.length !== commerceItemIds.length) throw new Error('Cart Link items must not be duplicated.')

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashCartLinkToken(rawToken)
  const supabase = await createClient()
  const rpc=supabase as unknown as {rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:string|null;error:{message:string}|null}>}
  const { data, error } = await rpc.rpc('create_flexible_commerce_cart_link', {
    p_mentee_id: menteeId,
    p_token_hash: tokenHash,
    p_commerce_item_ids: uniqueItemIds,
    p_private_mode:privateConfig?.mode??null,
    p_mentor_tier_id:privateConfig?.mentorTierId??null,
    p_target_enrollment_id:privateConfig?.targetEnrollmentId??null,
    p_session_count:privateConfig?.sessionCount??null,
    p_competition_category_id:privateConfig?.competitionCategoryId??null,
    p_competition_names:privateConfig?.competitionNames.map(value=>value.trim()).filter(Boolean)??[],
  })
  if (error?.message?.includes('Digital product already owned')) {
    throw new Error('Digital Products already owned by the mentee cannot be added to a Cart Link.')
  }
  if (error || !data) throw new Error(adminFormError(error, 'Unable to create the Cart Link. Check the mentee and item availability.'))

  return { id: data, url: `${origin.replace(/\/$/, '')}/cart-link/${rawToken}` }
}
