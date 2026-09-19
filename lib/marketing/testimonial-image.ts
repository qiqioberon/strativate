import {
  TESTIMONIAL_CROP_MAX_ZOOM,
  TESTIMONIAL_CROP_MIN_ZOOM,
  TESTIMONIAL_IMAGE_ASPECT_RATIO,
  TESTIMONIAL_IMAGE_HEIGHT,
  TESTIMONIAL_IMAGE_WIDTH,
} from './testimonial-config'

export type TestimonialCrop = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_TESTIMONIAL_CROP: TestimonialCrop = {
  x: 50,
  y: 50,
  zoom: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function calculateTestimonialSourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  crop: TestimonialCrop,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Dimensi gambar testimonial tidak valid.')
  }

  const sourceAspect = sourceWidth / sourceHeight
  let baseWidth: number
  let baseHeight: number

  if (sourceAspect > TESTIMONIAL_IMAGE_ASPECT_RATIO) {
    baseHeight = sourceHeight
    baseWidth = baseHeight * TESTIMONIAL_IMAGE_ASPECT_RATIO
  } else {
    baseWidth = sourceWidth
    baseHeight = baseWidth / TESTIMONIAL_IMAGE_ASPECT_RATIO
  }

  const zoom = clamp(crop.zoom, TESTIMONIAL_CROP_MIN_ZOOM, TESTIMONIAL_CROP_MAX_ZOOM)
  const width = baseWidth / zoom
  const height = baseHeight / zoom
  const x = (sourceWidth - width) * (clamp(crop.x, 0, 100) / 100)
  const y = (sourceHeight - height) * (clamp(crop.y, 0, 100) / 100)

  return { x, y, width, height }
}

export async function cropTestimonialImage(file: File, crop: TestimonialCrop) {
  const bitmap = await createImageBitmap(file)
  try {
    const source = calculateTestimonialSourceCrop(bitmap.width, bitmap.height, crop)
    const canvas = document.createElement('canvas')
    canvas.width = TESTIMONIAL_IMAGE_WIDTH
    canvas.height = TESTIMONIAL_IMAGE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak dapat menyiapkan editor crop.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      TESTIMONIAL_IMAGE_WIDTH,
      TESTIMONIAL_IMAGE_HEIGHT,
    )

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('Gambar testimonial gagal diproses.')),
        'image/webp',
        .9,
      )
    })
    return blob
  } finally {
    bitmap.close()
  }
}
