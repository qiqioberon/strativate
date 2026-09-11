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

const ready = (src: string, alt: string, notes: string, priority: AssetPriority = 'P0'): FrontendAsset => ({
  src, alt, notes, priority, placeholder: false, status: 'ready',
})

const missingPortrait = (name: string): FrontendAsset => ({
  src: '/assets/brand/strativate-mark.png',
  alt: `Foto ${name} belum tersedia`,
  notes: 'The mentor spreadsheet has no linked portrait; the approved brand mark is used as an explicit fallback.',
  priority: 'P0',
  placeholder: true,
  status: 'missing',
})

const placeholder = (src: string, alt: string, priority: AssetPriority, notes: string): FrontendAsset => ({
  src, alt, priority, notes, placeholder: true, status: 'placeholder',
})

export const assetRegistry = {
  'brand.logo.primary': ready('/assets/brand/strativate-wordmark.png', 'Strativate', 'Transparent PNG derivative of supplied Logo Strativate/6.png.'),
  'brand.logo.mark': ready('/assets/brand/strativate-mark.png', 'Strativate', 'Transparent PNG derivative of the mark supplied in Logo Strativate/1.png.'),

  'mentors.navira-putri.portrait': ready('/assets/mentors/navira-putri.webp', 'Navira Putri', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.safira-aulia.portrait': ready('/assets/mentors/safira-aulia.webp', 'Safira Aulia', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.aqil-drajat.portrait': ready('/assets/mentors/aqil-drajat.webp', 'Aqil Drajat', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.ilham-hakim.portrait': ready('/assets/mentors/ilham-hakim.webp', 'Ilham Hakim', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.rohananda-devi.portrait': ready('/assets/mentors/rohananda-devi.webp', 'Rohananda Devi', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.ratna-puspa.portrait': ready('/assets/mentors/ratna-puspa.webp', 'Ratna Puspa', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.ivonne-qiu.portrait': missingPortrait('Ivonne Qiu'),
  'mentors.fajri-alan.portrait': missingPortrait('Fajri Alan'),
  'mentors.deanna.portrait': missingPortrait('Deanna'),
  'mentors.cherien-stevie.portrait': ready('/assets/mentors/cherien-stevie.webp', 'Cherien Stevie', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.m-iqbal-banoza.portrait': ready('/assets/mentors/m-iqbal-banoza.webp', 'M. Iqbal Banoza', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.terry-kuron.portrait': missingPortrait('Terry Kuron'),
  'mentors.akmal-faqih.portrait': ready('/assets/mentors/akmal-faqih.webp', 'Akmal Faqih', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.syona-hana.portrait': ready('/assets/mentors/syona-hana.webp', 'Syona Hana', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.lubna-qumilaila.portrait': ready('/assets/mentors/lubna-qumilaila.webp', 'Lubna Qumilaila', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.albert-lukas.portrait': missingPortrait('Albert Lukas'),
  'mentors.ruth-debora.portrait': ready('/assets/mentors/ruth-debora.webp', 'Ruth Debora', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.muhammad-harits.portrait': ready('/assets/mentors/muhammad-harits.webp', 'Muhammad Harits', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.rafi-aurelian.portrait': ready('/assets/mentors/rafi-aurelian.webp', 'Rafi Aurelian', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.ratu-hanifa.portrait': ready('/assets/mentors/ratu-hanifa.webp', 'Ratu Hanifa', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.william-philip.portrait': ready('/assets/mentors/william-philip.webp', 'William Philip', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.alvaro-zhafran.portrait': ready('/assets/mentors/alvaro-zhafran.webp', 'Alvaro Zhafran', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.adrian-nicholas.portrait': ready('/assets/mentors/adrian-nicholas.webp', 'Adrian Nicholas', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.naura-tsabita-wibowo.portrait': ready('/assets/mentors/naura-tsabita-wibowo.webp', 'Naura Tsabita Wibowo', 'Optimized from the verified spreadsheet-linked portrait.'),
  'mentors.faluna-a-janitra.portrait': missingPortrait('Faluna A. Janitra'),
  'mentors.m-sultan-perkasa.portrait': missingPortrait('M. Sultan Perkasa'),

  'programs.private.cover': placeholder('/assets/placeholders/media-development.svg', 'Visual Private Mentoring belum tersedia', 'P1', 'No standalone approved program artwork was supplied.'),
  'programs.intensive.cover': placeholder('/assets/placeholders/media-development.svg', 'Visual Intensive Mentoring belum tersedia', 'P1', 'No standalone approved program artwork was supplied.'),
  'programs.bigClass.cover': placeholder('/assets/placeholders/media-development.svg', 'Visual Big Class belum tersedia', 'P1', 'No standalone approved program artwork was supplied.'),
  'products.guide.cover': placeholder('/assets/placeholders/cover-development.svg', 'Sampul produk digital belum tersedia', 'P0', 'Awaiting an approved product master.'),
  'products.template.cover': placeholder('/assets/placeholders/cover-development.svg', 'Sampul produk digital belum tersedia', 'P0', 'Awaiting an approved product master.'),
  'products.workbook.cover': placeholder('/assets/placeholders/cover-development.svg', 'Sampul produk digital belum tersedia', 'P0', 'Awaiting an approved product master.'),
  'achievements.featured.image': placeholder('/assets/placeholders/media-development.svg', 'Dokumentasi pencapaian belum tersedia', 'P1', 'Guidebooks contain embedded samples, but no standalone original media was supplied.'),
  'testimonials.featured.portrait': placeholder('/assets/placeholders/portrait-development.svg', 'Foto pemberi testimoni belum tersedia', 'P1', 'No standalone approved testimonial portrait was supplied.'),
  'institutions.featured.logo': placeholder('/assets/placeholders/logo-development.svg', 'Logo institusi belum tersedia', 'P1', 'Institution marks were not supplied as standalone approved assets.'),
} as const satisfies Record<string, FrontendAsset>

export type AssetKey = keyof typeof assetRegistry

export function getAsset(key: AssetKey): FrontendAsset { return assetRegistry[key] }
export function listAssets(): FrontendAsset[] { return Object.values(assetRegistry) }
