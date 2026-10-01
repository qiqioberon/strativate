export const TRUSTED_PARTNER_LOGO_BUCKET = 'marketing-editorial'
export const TRUSTED_PARTNER_LOGO_PREFIX = 'partner-logos/'
export const TRUSTED_PARTNER_LOGO_WIDTH = 800
export const TRUSTED_PARTNER_LOGO_HEIGHT = 400
export const TRUSTED_PARTNER_LOGO_MAX_FILE_SIZE = 5 * 1024 * 1024
export const TRUSTED_PARTNER_LOGO_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])
export const TRUSTED_PARTNER_LOGO_SAFE_INSET = .86
export const TRUSTED_PARTNER_LOGO_MIN_ZOOM = 1
export const TRUSTED_PARTNER_LOGO_MAX_ZOOM = 2.5
export const TRUSTED_PARTNER_LOGO_MAX_DECODED_PIXELS = 40_000_000
