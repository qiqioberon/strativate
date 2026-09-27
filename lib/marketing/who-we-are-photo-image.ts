import {
  WHO_WE_ARE_PHOTO_MAX_DECODED_PIXELS,
  WHO_WE_ARE_PHOTO_MAX_ZOOM,
  WHO_WE_ARE_PHOTO_MIN_ZOOM,
  WHO_WE_ARE_PHOTO_TARGETS,
  type WhoWeArePhotoRole,
} from './who-we-are-photo-config'

export type WhoWeArePhotoCrop = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_WHO_WE_ARE_CROP: WhoWeArePhotoCrop = {
  x: 50,
  y: 50,
  zoom: 1,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeWhoWeAreCrop(crop: WhoWeArePhotoCrop): WhoWeArePhotoCrop {
  return {
    x: clamp(crop.x, 0, 100),
    y: clamp(crop.y, 0, 100),
    zoom: clamp(crop.zoom, WHO_WE_ARE_PHOTO_MIN_ZOOM, WHO_WE_ARE_PHOTO_MAX_ZOOM),
  }
}

export function calculateWhoWeAreSourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  role: WhoWeArePhotoRole,
  crop: WhoWeArePhotoCrop,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Image dimensions are invalid.')
  }

  const target = WHO_WE_ARE_PHOTO_TARGETS[role]
  const targetAspect = target.width / target.height
  const sourceAspect = sourceWidth / sourceHeight
  let baseWidth: number
  let baseHeight: number

  if (sourceAspect > targetAspect) {
    baseHeight = sourceHeight
    baseWidth = baseHeight * targetAspect
  } else {
    baseWidth = sourceWidth
    baseHeight = baseWidth / targetAspect
  }

  const normalized = normalizeWhoWeAreCrop(crop)
  const width = baseWidth / normalized.zoom
  const height = baseHeight / normalized.zoom

  return {
    x: (sourceWidth - width) * (normalized.x / 100),
    y: (sourceHeight - height) * (normalized.y / 100),
    width,
    height,
  }
}

export function calculateWhoWeArePreviewPlacement(
  sourceWidth: number,
  sourceHeight: number,
  role: WhoWeArePhotoRole,
  crop: WhoWeArePhotoCrop,
) {
  const source = calculateWhoWeAreSourceCrop(sourceWidth, sourceHeight, role, crop)
  return {
    left: -(source.x / source.width) * 100,
    top: -(source.y / source.height) * 100,
    width: (sourceWidth / source.width) * 100,
    height: (sourceHeight / source.height) * 100,
  }
}

export async function cropWhoWeArePhoto(
  file: File,
  role: WhoWeArePhotoRole,
  crop: WhoWeArePhotoCrop,
) {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > WHO_WE_ARE_PHOTO_MAX_DECODED_PIXELS) {
      throw new Error('Image dimensions are too large to process safely.')
    }

    const target = WHO_WE_ARE_PHOTO_TARGETS[role]
    const source = calculateWhoWeAreSourceCrop(bitmap.width, bitmap.height, role, crop)
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser could not prepare the image editor.')

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
      target.width,
      target.height,
    )

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('The normalized image could not be generated.')),
        'image/webp',
        .9,
      )
    })
  } finally {
    bitmap.close()
  }
}
