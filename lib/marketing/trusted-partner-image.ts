import {
  TRUSTED_PARTNER_LOGO_HEIGHT,
  TRUSTED_PARTNER_LOGO_MAX_DECODED_PIXELS,
  TRUSTED_PARTNER_LOGO_MAX_ZOOM,
  TRUSTED_PARTNER_LOGO_MIN_ZOOM,
  TRUSTED_PARTNER_LOGO_SAFE_INSET,
  TRUSTED_PARTNER_LOGO_WIDTH,
} from './trusted-partner-config'

export type TrustedPartnerLogoFit = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_TRUSTED_PARTNER_LOGO_FIT: TrustedPartnerLogoFit = {
  x: 50,
  y: 50,
  zoom: 1,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeTrustedPartnerLogoFit(
  fit: TrustedPartnerLogoFit,
): TrustedPartnerLogoFit {
  return {
    x: clamp(fit.x, 0, 100),
    y: clamp(fit.y, 0, 100),
    zoom: clamp(
      fit.zoom,
      TRUSTED_PARTNER_LOGO_MIN_ZOOM,
      TRUSTED_PARTNER_LOGO_MAX_ZOOM,
    ),
  }
}

export function calculateTrustedPartnerLogoPlacement(
  sourceWidth: number,
  sourceHeight: number,
  fit: TrustedPartnerLogoFit,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Logo dimensions are invalid.')
  }

  const normalized = normalizeTrustedPartnerLogoFit(fit)
  const safeWidth = TRUSTED_PARTNER_LOGO_WIDTH * TRUSTED_PARTNER_LOGO_SAFE_INSET
  const safeHeight = TRUSTED_PARTNER_LOGO_HEIGHT * TRUSTED_PARTNER_LOGO_SAFE_INSET
  const baseScale = Math.min(safeWidth / sourceWidth, safeHeight / sourceHeight)
  const scale = baseScale * normalized.zoom
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  const x = width <= TRUSTED_PARTNER_LOGO_WIDTH
    ? (TRUSTED_PARTNER_LOGO_WIDTH - width) * (normalized.x / 100)
    : -(width - TRUSTED_PARTNER_LOGO_WIDTH) * (normalized.x / 100)
  const y = height <= TRUSTED_PARTNER_LOGO_HEIGHT
    ? (TRUSTED_PARTNER_LOGO_HEIGHT - height) * (normalized.y / 100)
    : -(height - TRUSTED_PARTNER_LOGO_HEIGHT) * (normalized.y / 100)

  return { x, y, width, height }
}

export async function fitTrustedPartnerLogo(
  file: File,
  fit: TrustedPartnerLogoFit,
) {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > TRUSTED_PARTNER_LOGO_MAX_DECODED_PIXELS) {
      throw new Error('Logo dimensions are too large to process safely.')
    }

    const placement = calculateTrustedPartnerLogoPlacement(
      bitmap.width,
      bitmap.height,
      fit,
    )
    const canvas = document.createElement('canvas')
    canvas.width = TRUSTED_PARTNER_LOGO_WIDTH
    canvas.height = TRUSTED_PARTNER_LOGO_HEIGHT
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
