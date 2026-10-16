export const DIGITAL_PRODUCT_IMAGE_BUCKET = 'digital-product-images'
export const DIGITAL_PRODUCT_IMAGE_NAMESPACE = 'products'
export const DIGITAL_PRODUCT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024
export const DIGITAL_PRODUCT_IMAGE_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])
// Explicit list: private cover source/crop columns are not readable by anon or authenticated users.
export const DIGITAL_PRODUCT_PUBLIC_COLUMNS = 'id,name,slug,description,image_path,price_amount,reference_price_amount,content_type,content_path,content_mime_type,content_file_name,content_size_bytes,page_count,duration_seconds,is_published,homepage_featured,homepage_featured_order,show_sales_count,show_rating,created_at,updated_at'
export const DIGITAL_PRODUCT_COVER_SOURCE_PREFIX = 'digital-products/'
export const DIGITAL_PRODUCT_COVER_WIDTH = 1000
export const DIGITAL_PRODUCT_COVER_HEIGHT = 1250
export const DIGITAL_PRODUCT_COVER_MIN_ZOOM = 1
export const DIGITAL_PRODUCT_COVER_MAX_ZOOM = 3
export const DIGITAL_PRODUCT_COVER_MAX_DECODED_PIXELS = 40_000_000
export const DIGITAL_PRODUCT_COVER_WEBP_QUALITY = .9

export const DIGITAL_PRODUCT_CONTENT_BUCKET = 'digital-product-content'
export const DIGITAL_PRODUCT_CONTENT_NAMESPACE = 'products'
export const DIGITAL_PRODUCT_CONTENT_MAX_FILE_SIZE = 500 * 1024 * 1024
export const DIGITAL_PRODUCT_PDF_ALLOWED_TYPES = new Set<string>(['application/pdf'])
export const DIGITAL_PRODUCT_VIDEO_ALLOWED_TYPES = new Set<string>(['video/mp4', 'video/webm'])
export const DIGITAL_PRODUCT_CONTENT_SIGNED_URL_SECONDS = 120
