import {
  TESTIMONIAL_IMAGE_ALLOWED_TYPES,
  TESTIMONIAL_IMAGE_MAX_FILE_SIZE,
} from './testimonial-config'
import type { MarketingTestimonial } from '../supabase/database.types'

export type TestimonialFile = Pick<File, 'size' | 'type'>
export type TestimonialDraftErrors = Partial<Record<
  'slug' | 'competitionName' | 'achievement' | 'testimonial' | 'file',
  string
>>

export function normalizeTestimonialSlug(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function isTestimonialSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('marketing_testimonials') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}

export function validateTestimonialDraft({
  slug,
  competitionName,
  achievement,
  testimonial,
  file,
}: {
  slug: string
  competitionName: string
  achievement: string
  testimonial: string
  file: TestimonialFile | null
}): TestimonialDraftErrors {
  const errors: TestimonialDraftErrors = {}
  if (!slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) errors.slug = 'Slug wajib memakai huruf kecil, angka, dan tanda hubung.'
  if (!competitionName.trim()) errors.competitionName = 'Nama kompetisi wajib diisi.'
  if (!achievement.trim()) errors.achievement = 'Pencapaian wajib diisi.'
  if (!testimonial.trim()) errors.testimonial = 'Isi testimoni wajib diisi.'
  if (file && !TESTIMONIAL_IMAGE_ALLOWED_TYPES.has(file.type)) errors.file = 'Gunakan gambar JPG, PNG, atau WebP.'
  else if (file && file.size > TESTIMONIAL_IMAGE_MAX_FILE_SIZE) errors.file = 'Ukuran gambar maksimal 5 MB.'
  return errors
}

export function buildTestimonialPayload({
  slug,
  competitionName,
  achievement,
  testimonial,
  imagePath,
  storedImagePath,
  originalImagePath,
  storedOriginalImagePath,
  isPublished,
}: {
  slug: string
  competitionName: string
  achievement: string
  testimonial: string
  imagePath: string | null
  storedImagePath: string | null
  originalImagePath: string | null
  storedOriginalImagePath: string | null
  isPublished: boolean
}) {
  return {
    slug: slug.trim(),
    competition_name: competitionName.trim(),
    achievement: achievement.trim(),
    testimonial: testimonial.trim(),
    image_path: imagePath ?? storedImagePath,
    original_image_path: originalImagePath ?? storedOriginalImagePath,
    is_published: isPublished,
  }
}

export function getNextTestimonialSortOrder(items: MarketingTestimonial[]) {
  if (!items.length) return 1
  return Math.max(...items.map(item => item.sort_order)) + 1
}

export function reorderTestimonialIds(items: MarketingTestimonial[], index: number, direction: -1 | 1) {
  const ids = items.map(item => item.id)
  const destination = index + direction
  if (index < 0 || index >= items.length || destination < 0 || destination >= items.length) return ids
  ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
  return ids
}


export function buildTestimonialAltText(competitionName: string) {
  const label = competitionName.trim()
  return label ? `Peserta ${label} setelah kompetisi.` : 'Peserta Strativate setelah kompetisi.'
}

export function testimonialOriginalExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
