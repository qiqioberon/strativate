import {
  WHO_WE_ARE_PHOTO_ALLOWED_TYPES,
  WHO_WE_ARE_PHOTO_MAX_FILE_SIZE,
} from './who-we-are-photo-config'

export type WhoWeArePhotoFile = Pick<File, 'size' | 'type'>
export type WhoWeArePhotoDraftErrors = Partial<Record<'altText' | 'badgeText' | 'file', string>>

export function validateWhoWeArePhotoDraft({
  altText,
  file,
  hasStoredImage,
  removeImage,
}: {
  altText: string
  file: WhoWeArePhotoFile | null
  hasStoredImage: boolean
  removeImage: boolean
}): WhoWeArePhotoDraftErrors {
  const errors: WhoWeArePhotoDraftErrors = {}
  const willHaveImage = !removeImage && Boolean(file || hasStoredImage)

  if (!file && !hasStoredImage && !removeImage) errors.file = 'Choose an image for this slot.'
  if (file && !WHO_WE_ARE_PHOTO_ALLOWED_TYPES.has(file.type)) errors.file = 'Use a JPG, PNG, or WebP image.'
  else if (file && file.size > WHO_WE_ARE_PHOTO_MAX_FILE_SIZE) errors.file = 'Image size must be 8 MB or smaller.'

  if (willHaveImage && !altText.trim()) errors.altText = 'Alt text is required when an image exists.'
  else if (altText.trim().length > 300) errors.altText = 'Alt text must be 300 characters or fewer.'

  return errors
}

export function buildWhoWeArePhotoPayload({
  altText,
  badgeText,
  uploadedPath,
  storedImagePath,
  removeImage,
}: {
  altText: string
  badgeText: string
  uploadedPath: string | null
  storedImagePath: string | null
  removeImage: boolean
}) {
  if (removeImage) {
    return { image_path: null, alt_text: null, badge_text: null }
  }

  return {
    image_path: uploadedPath ?? storedImagePath,
    alt_text: altText.trim(),
    badge_text: badgeText.trim() || null,
  }
}

export function isWhoWeArePhotoSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST202'
    || code === 'PGRST205'
    || code === '42P01'
    || (message.includes('homepage_who_we_are_photos') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}
