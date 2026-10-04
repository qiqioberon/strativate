export type NormalizedCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CropOutput = {
  file: File
  crop: NormalizedCropRect
  sourceWidth: number
  sourceHeight: number
}

export const PHOTO_SOURCE_BUCKET = 'marketing-photo-sources'

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

export function maximumCenteredCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number,
): NormalizedCropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const sourceAspect = sourceWidth / sourceHeight
  if (sourceAspect > aspectRatio) {
    const width = aspectRatio / sourceAspect
    return { x: (1 - width) / 2, y: 0, width, height: 1 }
  }

  const height = sourceAspect / aspectRatio
  return { x: 0, y: (1 - height) / 2, width: 1, height }
}

export function normalizeCropRect(
  value: NormalizedCropRect | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number,
): NormalizedCropRect {
  const fallback = maximumCenteredCrop(sourceWidth, sourceHeight, aspectRatio)
  if (!value || sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) return fallback

  const expectedNormalizedRatio = aspectRatio * sourceHeight / sourceWidth
  let width = clamp(Number(value.width) || fallback.width, 0.0001, 1)
  let height = width / expectedNormalizedRatio
  if (height > 1) {
    height = 1
    width = height * expectedNormalizedRatio
  }

  return {
    x: clamp(Number(value.x) || 0, 0, 1 - width),
    y: clamp(Number(value.y) || 0, 0, 1 - height),
    width,
    height,
  }
}

export function cropSourcePixels(
  crop: NormalizedCropRect,
  sourceWidth: number,
  sourceHeight: number,
) {
  return {
    x: crop.x * sourceWidth,
    y: crop.y * sourceHeight,
    width: crop.width * sourceWidth,
    height: crop.height * sourceHeight,
  }
}

export function cropRectFromJson(value: unknown): NormalizedCropRect | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (!['x', 'y', 'width', 'height'].every(key => typeof candidate[key] === 'number')) return null
  const crop: NormalizedCropRect = {
    x: candidate.x as number,
    y: candidate.y as number,
    width: candidate.width as number,
    height: candidate.height as number,
  }
  if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) return null
  if (crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001) return null
  return crop
}

export function sourceExtension(source: { type: string }) {
  if (source.type === 'image/png') return 'png'
  if (source.type === 'image/webp') return 'webp'
  return 'jpg'
}
