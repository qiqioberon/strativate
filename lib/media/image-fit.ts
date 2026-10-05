export type ImageFit = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_IMAGE_FIT: ImageFit = {
  x: 50,
  y: 50,
  zoom: 1,
}

export type ImageFitTarget = {
  width: number
  height: number
  minZoom?: number
  maxZoom?: number
  quality?: number
  maxDecodedPixels?: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeImageFit(
  fit: ImageFit,
  minZoom = 1,
  maxZoom = 3,
): ImageFit {
  return {
    x: clamp(fit.x, 0, 100),
    y: clamp(fit.y, 0, 100),
    zoom: clamp(fit.zoom, minZoom, maxZoom),
  }
}

export function calculateCoverImagePlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFit,
  minZoom = 1,
  maxZoom = 3,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Image dimensions are invalid.')
  }

  const normalized = normalizeImageFit(fit, minZoom, maxZoom)
  const baseScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const scale = baseScale * normalized.zoom
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const overflowX = Math.max(0, width - targetWidth)
  const overflowY = Math.max(0, height - targetHeight)

  return {
    x: -overflowX * (normalized.x / 100),
    y: -overflowY * (normalized.y / 100),
    width,
    height,
  }
}

export async function fitImageToWebP(
  file: File,
  target: ImageFitTarget,
  fit: ImageFit,
) {
  const bitmap = await createImageBitmap(file)
  try {
    const maxDecodedPixels = target.maxDecodedPixels ?? 40_000_000
    if (bitmap.width * bitmap.height > maxDecodedPixels) {
      throw new Error('Image dimensions are too large to process safely.')
    }

    const placement = calculateCoverImagePlacement(
      bitmap.width,
      bitmap.height,
      target.width,
      target.height,
      fit,
      target.minZoom ?? 1,
      target.maxZoom ?? 3,
    )

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser could not prepare the image editor.')

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    )

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result
          ? resolve(result)
          : reject(new Error('The normalized image could not be generated.')),
        'image/webp',
        target.quality ?? .9,
      )
    })
  } finally {
    bitmap.close()
  }
}
