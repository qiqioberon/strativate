import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { TrustedPartner } from '@/lib/supabase/database.types'

import { TRUSTED_PARTNER_LOGO_BUCKET } from './trusted-partner-config'

export type TrustedPartnerView = Pick<
  TrustedPartner,
  'id' | 'organization_name' | 'display_order'
> & {
  logoUrl: string
}

export async function listActiveTrustedPartners(): Promise<TrustedPartnerView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trusted_partners')
    .select('id,organization_name,logo_path,display_order')
    .eq('is_active', true)
    .order('display_order')
    .order('created_at')
    .order('id')

  if (error) {
    console.warn('Trusted partners are unavailable.', { code: error.code })
    return []
  }

  return (data ?? []).map((partner) => ({
    id: partner.id,
    organization_name: partner.organization_name,
    display_order: partner.display_order,
    logoUrl: supabase.storage.from(TRUSTED_PARTNER_LOGO_BUCKET).getPublicUrl(partner.logo_path).data.publicUrl,
  }))
}
