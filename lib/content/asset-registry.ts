export type AssetStatus = 'placeholder' | 'missing' | 'ready'
export type AssetPriority = 'P0' | 'P1' | 'P2'

export type FrontendAsset = {
  src: string
  placeholder: boolean
  status: AssetStatus
  alt: string
  priority: AssetPriority
  notes: string
}

const placeholder = (
  src: string,
  alt: string,
  priority: AssetPriority,
  notes: string,
): FrontendAsset => ({
  src,
  placeholder: true,
  status: 'placeholder',
  alt,
  priority,
  notes,
})

export const assetRegistry = {
  'brand.logo.primary': placeholder(
    '/assets/placeholders/logo-development.svg',
    'Placeholder logo utama Strativate',
    'P0',
    'Replace with the approved horizontal Strativate SVG wordmark.',
  ),
  'brand.logo.mark': placeholder(
    '/assets/placeholders/logo-development.svg',
    'Placeholder logo mark Strativate',
    'P0',
    'Replace with the approved standalone Strativate mark.',
  ),
  'mentors.primary.portrait': placeholder(
    '/assets/placeholders/portrait-development.svg',
    'Placeholder portrait mentor Strativate',
    'P0',
    'Awaiting a verified mentor roster, original portrait, and publication consent.',
  ),
  'mentors.secondary.portrait': placeholder(
    '/assets/placeholders/portrait-development.svg',
    'Placeholder portrait mentor Strativate',
    'P0',
    'Awaiting a verified mentor roster, original portrait, and publication consent.',
  ),
  'mentors.tertiary.portrait': placeholder(
    '/assets/placeholders/portrait-development.svg',
    'Placeholder portrait mentor Strativate',
    'P0',
    'Awaiting a verified mentor roster, original portrait, and publication consent.',
  ),
  'programs.private.cover': placeholder(
    '/assets/placeholders/media-development.svg',
    'Placeholder visual Mentoring Privat',
    'P1',
    'Optional program visual; factual program copy remains sourced separately.',
  ),
  'programs.intensive.cover': placeholder(
    '/assets/placeholders/media-development.svg',
    'Placeholder visual Mentoring Intensif',
    'P1',
    'Optional program visual; factual program copy remains sourced separately.',
  ),
  'programs.bigClass.cover': placeholder(
    '/assets/placeholders/media-development.svg',
    'Placeholder visual Big Class',
    'P1',
    'Awaiting the complete approved Big Class production master.',
  ),
  'products.guide.cover': placeholder(
    '/assets/placeholders/cover-development.svg',
    'Placeholder sampul produk digital',
    'P0',
    'Awaiting an approved product name, price, cover, and deliverable file.',
  ),
  'products.template.cover': placeholder(
    '/assets/placeholders/cover-development.svg',
    'Placeholder sampul produk digital',
    'P0',
    'Awaiting an approved product name, price, cover, and deliverable file.',
  ),
  'products.workbook.cover': placeholder(
    '/assets/placeholders/cover-development.svg',
    'Placeholder sampul produk digital',
    'P0',
    'Awaiting an approved product name, price, cover, and deliverable file.',
  ),
  'achievements.featured.image': placeholder(
    '/assets/placeholders/media-development.svg',
    'Placeholder dokumentasi pencapaian',
    'P1',
    'Awaiting original media, exact factual caption, and publication rights.',
  ),
  'testimonials.featured.portrait': placeholder(
    '/assets/placeholders/portrait-development.svg',
    'Placeholder portrait testimonial',
    'P1',
    'Awaiting an approved quote, identity, portrait, and publication consent.',
  ),
  'institutions.featured.logo': placeholder(
    '/assets/placeholders/logo-development.svg',
    'Placeholder logo institusi',
    'P1',
    'Use only after institution wording and official logo usage are approved.',
  ),
} as const satisfies Record<string, FrontendAsset>

export type AssetKey = keyof typeof assetRegistry

export function getAsset(key: AssetKey): FrontendAsset {
  return assetRegistry[key]
}

export function listAssets(): FrontendAsset[] {
  return Object.values(assetRegistry)
}
