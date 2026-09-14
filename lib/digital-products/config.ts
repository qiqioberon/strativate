export const DIGITAL_PRODUCT_IMAGE_BUCKET = 'digital-product-images'
export const DIGITAL_PRODUCT_IMAGE_NAMESPACE = 'products'
export const DIGITAL_PRODUCT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024
export const DIGITAL_PRODUCT_IMAGE_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const DIGITAL_PRODUCT_CONTENT_BUCKET = 'digital-product-content'
export const DIGITAL_PRODUCT_CONTENT_NAMESPACE = 'products'
export const DIGITAL_PRODUCT_CONTENT_MAX_FILE_SIZE = 500 * 1024 * 1024
export const DIGITAL_PRODUCT_PDF_ALLOWED_TYPES = new Set<string>(['application/pdf'])
export const DIGITAL_PRODUCT_VIDEO_ALLOWED_TYPES = new Set<string>(['video/mp4', 'video/webm'])
export const DIGITAL_PRODUCT_CONTENT_SIGNED_URL_SECONDS = 120
