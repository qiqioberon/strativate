import {
  COMPETITION_RECOGNITION_LOGO_HEIGHT,
  COMPETITION_RECOGNITION_LOGO_MAX_DECODED_PIXELS,
  COMPETITION_RECOGNITION_LOGO_MAX_ZOOM,
  COMPETITION_RECOGNITION_LOGO_MIN_ZOOM,
  COMPETITION_RECOGNITION_LOGO_SAFE_INSET,
  COMPETITION_RECOGNITION_LOGO_WIDTH,
} from './competition-recognition-config'

export type CompetitionRecognitionLogoFit = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT: CompetitionRecognitionLogoFit = {
  x: 50,
  y: 50,
  zoom: 1,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeCompetitionRecognitionLogoFit(
  fit: CompetitionRecognitionLogoFit,
): CompetitionRecognitionLogoFit {
  return {
    x: clamp(fit.x, 0, 100),
    y: clamp(fit.y, 0, 100),
    zoom: clamp(
      fit.zoom,
      COMPETITION_RECOGNITION_LOGO_MIN_ZOOM,
      COMPETITION_RECOGNITION_LOGO_MAX_ZOOM,
    ),
  }
}

export function calculateCompetitionRecognitionLogoPlacement(
  sourceWidth: number,
  sourceHeight: number,
  fit: CompetitionRecognitionLogoFit,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Logo dimensions are invalid.')
  }

  const normalized = normalizeCompetitionRecognitionLogoFit(fit)
  const safeWidth = COMPETITION_RECOGNITION_LOGO_WIDTH * COMPETITION_RECOGNITION_LOGO_SAFE_INSET
  const safeHeight = COMPETITION_RECOGNITION_LOGO_HEIGHT * COMPETITION_RECOGNITION_LOGO_SAFE_INSET
  const baseScale = Math.min(safeWidth / sourceWidth, safeHeight / sourceHeight)
  const scale = baseScale * normalized.zoom
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  const x = width <= COMPETITION_RECOGNITION_LOGO_WIDTH
    ? (COMPETITION_RECOGNITION_LOGO_WIDTH - width) * (normalized.x / 100)
    : -(width - COMPETITION_RECOGNITION_LOGO_WIDTH) * (normalized.x / 100)
  const y = height <= COMPETITION_RECOGNITION_LOGO_HEIGHT
    ? (COMPETITION_RECOGNITION_LOGO_HEIGHT - height) * (normalized.y / 100)
    : -(height - COMPETITION_RECOGNITION_LOGO_HEIGHT) * (normalized.y / 100)

  return { x, y, width, height }
}

export async function fitCompetitionRecognitionLogo(
  file: File,
  fit: CompetitionRecognitionLogoFit,
) {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > COMPETITION_RECOGNITION_LOGO_MAX_DECODED_PIXELS) {
      throw new Error('Logo dimensions are too large to process safely.')
    }

    const placement = calculateCompetitionRecognitionLogoPlacement(
      bitmap.width,
      bitmap.height,
      fit,
    )
    const canvas = document.createElement('canvas')
    canvas.width = COMPETITION_RECOGNITION_LOGO_WIDTH
    canvas.height = COMPETITION_RECOGNITION_LOGO_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser could not prepare the logo editor.')

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
          : reject(new Error('The normalized logo could not be generated.')),
        'image/webp',
        .92,
      )
    })
  } finally {
    bitmap.close()
  }
}
