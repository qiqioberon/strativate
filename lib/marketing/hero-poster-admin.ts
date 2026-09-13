import {
  HERO_POSTER_ALLOWED_TYPES,
  HERO_POSTER_MAX_FILE_SIZE,
} from './hero-poster-config'
import type { MarketingHeroPoster } from '../supabase/database.types'

export type HeroPosterSummary = {
  total: number
  active: number
  inactive: number
  label: 'Fallback aktif' | 'Poster tunggal' | 'Carousel aktif'
  message: string
  tone: 'fallback' | 'single' | 'carousel'
}

export type HeroPosterFile = Pick<File, 'size' | 'type'>

export type HeroPosterDraftErrors = Partial<Record<'file' | 'altText' | 'url' | 'sortOrder', string>>

export function getHeroPosterSummary(posters: MarketingHeroPoster[]): HeroPosterSummary {
  const active = posters.filter(poster => poster.is_active).length
  const counts = { total: posters.length, active, inactive: posters.length - active }

  if (active === 0) {
    return {
      ...counts,
      label: 'Fallback aktif',
      message: 'Beranda masih menggunakan visual brand bawaan.',
      tone: 'fallback',
    }
  }

  if (active === 1) {
    return {
      ...counts,
      label: 'Poster tunggal',
      message: 'Poster akan tampil di hero, tetapi carousel tidak berpindah karena hanya ada satu poster aktif.',
      tone: 'single',
    }
  }

  return {
    ...counts,
    label: 'Carousel aktif',
    message: `${active} poster aktif akan diputar otomatis di beranda.`,
    tone: 'carousel',
  }
}

export function isHeroPosterSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('marketing_hero_posters') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}

export function validateHeroPosterDraft({
  altText,
  url,
  sortOrder,
  file,
  hasStoredImage,
}: {
  altText: string
  url: string
  sortOrder: string
  file: HeroPosterFile | null
  hasStoredImage: boolean
}): HeroPosterDraftErrors {
  const errors: HeroPosterDraftErrors = {}
  if (!file && !hasStoredImage) errors.file = 'Pilih gambar poster untuk membuat entri baru.'
  if (file && !HERO_POSTER_ALLOWED_TYPES.has(file.type)) errors.file = 'Gunakan gambar JPG, PNG, atau WebP.'
  else if (file && file.size > HERO_POSTER_MAX_FILE_SIZE) errors.file = 'Ukuran gambar maksimal 5 MB.'
  if (!altText.trim()) errors.altText = 'Teks alternatif wajib diisi.'
  if (url.trim() && (!url.trim().startsWith('/') || url.trim().startsWith('//'))) {
    errors.url = 'Gunakan path internal yang diawali / dan bukan //.'
  }
  const parsedOrder = Number(sortOrder)
  if (!Number.isInteger(parsedOrder) || parsedOrder < -100000 || parsedOrder > 100000) {
    errors.sortOrder = 'Urutan harus berupa bilangan bulat antara -100000 dan 100000.'
  }
  return errors
}

export function buildHeroPosterPayload({
  imagePath,
  storedImagePath,
  altText,
  title,
  url,
  sortOrder,
  isActive,
}: {
  imagePath: string | null
  storedImagePath: string | null
  altText: string
  title: string
  url: string
  sortOrder: string
  isActive: boolean
}) {
  return {
    image_path: imagePath ?? storedImagePath!,
    alt_text: altText.trim(),
    title: title.trim() || null,
    url: url.trim() || null,
    sort_order: Number(sortOrder),
    is_active: isActive,
  }
}

export function reorderHeroPosterIds(posters: MarketingHeroPoster[], index: number, direction: -1 | 1) {
  const ids = posters.map(poster => poster.id)
  const destination = index + direction
  if (index < 0 || index >= ids.length || destination < 0 || destination >= ids.length) return ids
  ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
  return ids
}

export function safeHeroPosterFileName(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'poster'
}
