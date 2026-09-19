export const TESTIMONIAL_IMAGE_BUCKET = 'marketing-testimonials'
export const TESTIMONIAL_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024
export const TESTIMONIAL_IMAGE_WIDTH = 1200
export const TESTIMONIAL_IMAGE_HEIGHT = 960
export const TESTIMONIAL_IMAGE_ASPECT_RATIO = TESTIMONIAL_IMAGE_WIDTH / TESTIMONIAL_IMAGE_HEIGHT
export const TESTIMONIAL_CROP_MIN_ZOOM = 1
export const TESTIMONIAL_CROP_MAX_ZOOM = 2.5
export const TESTIMONIAL_IMAGE_ALLOWED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])
