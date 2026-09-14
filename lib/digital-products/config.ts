export const DIGITAL_PRODUCT_IMAGE_BUCKET = 'digital-product-images'
export const DIGITAL_PRODUCT_IMAGE_NAMESPACE = 'products'
export const DIGITAL_PRODUCT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024
export const DIGITAL_PRODUCT_IMAGE_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])
