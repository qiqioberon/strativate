import type { TrustedPartner } from '@/lib/supabase/database.types'

import {
  TRUSTED_PARTNER_LOGO_ALLOWED_TYPES,
  TRUSTED_PARTNER_LOGO_MAX_FILE_SIZE,
} from './trusted-partner-config'

export type TrustedPartnerFile = Pick<File, 'size' | 'type'>
export type TrustedPartnerDraftErrors = Partial<Record<'organizationName' | 'file', string>>

export function validateTrustedPartnerDraft({
  organizationName,
  file,
  hasStoredLogo,
}: {
  organizationName: string
  file: TrustedPartnerFile | null
  hasStoredLogo: boolean
}): TrustedPartnerDraftErrors {
  const errors: TrustedPartnerDraftErrors = {}
  const name = organizationName.trim()
  if (!name) errors.organizationName = 'Organization name is required.'
  else if (name.length > 180) errors.organizationName = 'Organization name must be 180 characters or fewer.'

  if (!file && !hasStoredLogo) errors.file = 'Choose a logo for the new partner.'
  if (file && !TRUSTED_PARTNER_LOGO_ALLOWED_TYPES.has(file.type)) errors.file = 'Use a JPG, PNG, or WebP image.'
  else if (file && file.size > TRUSTED_PARTNER_LOGO_MAX_FILE_SIZE) errors.file = 'Logo size must be 5 MB or smaller.'

  return errors
}

export function buildTrustedPartnerPayload({
  organizationName,
  logoPath,
  storedLogoPath,
  isActive,
}: {
  organizationName: string
  logoPath: string | null
  storedLogoPath: string | null
  isActive: boolean
}) {
  return {
    organization_name: organizationName.trim(),
    logo_path: logoPath ?? storedLogoPath!,
    is_active: isActive,
  }
}

export function getNextTrustedPartnerOrder(records: TrustedPartner[]) {
  return records.length ? Math.max(...records.map(record => record.display_order)) + 1 : 1
}

export function reorderTrustedPartnerIds(records: TrustedPartner[], index: number, direction: -1 | 1) {
  const ids = records.map(record => record.id)
  const destination = index + direction
  if (index < 0 || index >= ids.length || destination < 0 || destination >= ids.length) return ids
  ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
  return ids
}

export function safePartnerLogoFileName(name: string, contentType?: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const safeName = normalized || 'logo'
  if (/\.(jpe?g|png|webp)$/i.test(safeName) || !contentType) return safeName
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
  return safeName + '.' + extension
}

export function isTrustedPartnerSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('trusted_partners') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}
