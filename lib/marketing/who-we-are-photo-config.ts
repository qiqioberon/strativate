export const WHO_WE_ARE_PHOTO_BUCKET = 'marketing-editorial'
export const WHO_WE_ARE_PHOTO_PREFIX = 'who-we-are/'
export const WHO_WE_ARE_PHOTO_ROLES = ['primary', 'upper_right', 'lower_right'] as const
export type WhoWeArePhotoRole = typeof WHO_WE_ARE_PHOTO_ROLES[number]

export const WHO_WE_ARE_PHOTO_TARGETS: Record<
  WhoWeArePhotoRole,
  { label: string; width: number; height: number }
> = {
  primary: { label: 'Primary photo', width: 1200, height: 1600 },
  upper_right: { label: 'Upper-right photo', width: 1000, height: 1000 },
  lower_right: { label: 'Lower-right photo', width: 1000, height: 1000 },
}

export const WHO_WE_ARE_PHOTO_MAX_FILE_SIZE = 8 * 1024 * 1024
export const WHO_WE_ARE_PHOTO_MAX_DECODED_PIXELS = 40_000_000
export const WHO_WE_ARE_PHOTO_MIN_ZOOM = 1
export const WHO_WE_ARE_PHOTO_MAX_ZOOM = 3
export const WHO_WE_ARE_PHOTO_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export function whoWeArePhotoPathPrefix(role: WhoWeArePhotoRole) {
  return WHO_WE_ARE_PHOTO_PREFIX + role + '/'
}
