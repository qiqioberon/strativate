import { formError } from '../auth/errors'
import {
  DIGITAL_PRODUCT_CONTENT_MAX_FILE_SIZE,
  DIGITAL_PRODUCT_CONTENT_NAMESPACE,
  DIGITAL_PRODUCT_IMAGE_ALLOWED_TYPES,
  DIGITAL_PRODUCT_IMAGE_MAX_FILE_SIZE,
  DIGITAL_PRODUCT_IMAGE_NAMESPACE,
  DIGITAL_PRODUCT_PDF_ALLOWED_TYPES,
  DIGITAL_PRODUCT_VIDEO_ALLOWED_TYPES,
} from './config'

const NAME_MAX_LENGTH = 160
const SLUG_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 5000
const STRICT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type DigitalProductContentType = 'pdf' | 'video'
export type DigitalProductFile = Pick<File, 'size' | 'type'> & Partial<Pick<File, 'name'>>
export type DigitalProductDraftErrors = Partial<Record<'name' | 'slug' | 'description' | 'price' | 'file', string>>

export function normalizeDigitalProductSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseDigitalProductPriceInput(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  try {
    const parsed = BigInt(trimmed)
    if (parsed < BigInt(0) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null
    return Number(parsed)
  } catch {
    return null
  }
}

export function formatDigitalProductPrice(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) return 'Rp0'
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`
}

export function validateDigitalProductDraft({
  name,
  slug,
  description,
  priceInput,
  file,
  hasStoredImage,
}: {
  name: string
  slug: string
  description: string
  priceInput: string
  file: DigitalProductFile | null
  hasStoredImage: boolean
}): DigitalProductDraftErrors {
  const errors: DigitalProductDraftErrors = {}
  const trimmedName = name.trim()
  const trimmedSlug = slug.trim()
  const trimmedDescription = description.trim()

  if (!trimmedName) errors.name = 'Nama produk wajib diisi.'
  else if (trimmedName.length > NAME_MAX_LENGTH) errors.name = `Nama produk maksimal ${NAME_MAX_LENGTH} karakter.`

  if (!trimmedSlug) errors.slug = 'Slug wajib diisi.'
  else if (slug !== trimmedSlug || trimmedSlug.length > SLUG_MAX_LENGTH || !STRICT_SLUG.test(trimmedSlug)) {
    errors.slug = 'Slug harus menggunakan huruf kecil, angka, dan tanda hubung tanpa spasi.'
  }

  if (!trimmedDescription) errors.description = 'Deskripsi wajib diisi.'
  else if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) errors.description = `Deskripsi maksimal ${DESCRIPTION_MAX_LENGTH} karakter.`

  if (parseDigitalProductPriceInput(priceInput) === null) {
    errors.price = 'Harga harus berupa Rupiah bulat bernilai 0 atau lebih.'
  }

  if (!file && !hasStoredImage) errors.file = 'Pilih cover image untuk membuat Digital Product.'
  if (file && !DIGITAL_PRODUCT_IMAGE_ALLOWED_TYPES.has(file.type)) errors.file = 'Gunakan gambar JPG, PNG, atau WebP.'
  else if (file && file.size > DIGITAL_PRODUCT_IMAGE_MAX_FILE_SIZE) errors.file = 'Ukuran gambar maksimal 5 MB.'

  return errors
}

export function validateDigitalProductContentFile({
  file,
  contentType,
  hasStoredContent,
  publishing = false,
}: {
  file: DigitalProductFile | null
  contentType: DigitalProductContentType | null
  hasStoredContent: boolean
  publishing?: boolean
}) {
  if (!contentType) {
    return publishing || file || hasStoredContent ? 'Pilih Jenis Produk PDF atau Video.' : null
  }
  if (!file && !hasStoredContent) {
    return publishing ? 'Upload materi sebelum mempublikasikan Digital Product.' : null
  }
  if (!file) return null
  if (file.size <= 0) return 'File materi tidak valid.'
  if (file.size > DIGITAL_PRODUCT_CONTENT_MAX_FILE_SIZE) return 'Ukuran materi maksimal 500 MB.'

  const allowed = contentType === 'pdf' ? DIGITAL_PRODUCT_PDF_ALLOWED_TYPES : DIGITAL_PRODUCT_VIDEO_ALLOWED_TYPES
  if (!allowed.has(file.type)) {
    return contentType === 'pdf'
      ? 'Materi PDF harus menggunakan file PDF.'
      : 'Materi Video harus menggunakan MP4 atau WebM.'
  }

  const extension = file.name?.trim().toLowerCase().split('.').pop() ?? ''
  if (contentType === 'pdf' && extension !== 'pdf') {
    return 'Materi PDF harus menggunakan file PDF dengan ekstensi .pdf.'
  }
  if (contentType === 'video') {
    const expectedExtension = file.type === 'video/mp4' ? 'mp4' : file.type === 'video/webm' ? 'webm' : ''
    if (!expectedExtension || extension !== expectedExtension) {
      return 'Materi Video harus menggunakan file MP4 atau WebM dengan ekstensi yang sesuai.'
    }
  }
  return null
}

export function safeDigitalProductFileName(name: string) {
  const leaf = name.replace(/\\/g, '/').split('/').pop() ?? ''
  const normalized = leaf
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '')
  return normalized || 'cover'
}

export function buildDigitalProductImagePath(fileName: string) {
  return `${DIGITAL_PRODUCT_IMAGE_NAMESPACE}/${crypto.randomUUID()}-${safeDigitalProductFileName(fileName)}`
}

export function buildDigitalProductContentPath(fileName: string) {
  return `${DIGITAL_PRODUCT_CONTENT_NAMESPACE}/${crypto.randomUUID()}/${safeDigitalProductFileName(fileName) || 'content'}`
}

export function buildDigitalProductPayload({
  name,
  slug,
  description,
  priceInput,
  imagePath,
  storedImagePath,
}: {
  name: string
  slug: string
  description: string
  priceInput: string
  imagePath: string | null
  storedImagePath: string | null
}) {
  const priceAmount = parseDigitalProductPriceInput(priceInput)
  const authoritativeImagePath = imagePath ?? storedImagePath
  if (priceAmount === null || !authoritativeImagePath) throw new Error('Digital Product payload was built before validation completed.')

  return {
    name: name.trim(),
    slug: slug.trim(),
    description: description.trim(),
    image_path: authoritativeImagePath,
    price_amount: priceAmount,
  }
}

export function buildDigitalProductContentPayload({
  contentType,
  contentPath,
  storedContentPath,
  fileName,
  storedFileName,
  mimeType,
  storedMimeType,
  fileSize,
  storedFileSize,
  isPublished,
}: {
  contentType: DigitalProductContentType | null
  contentPath: string | null
  storedContentPath: string | null
  fileName: string | null
  storedFileName: string | null
  mimeType: string | null
  storedMimeType: string | null
  fileSize: number | null
  storedFileSize: number | null
  isPublished: boolean
}) {
  const authoritativePath = contentPath ?? storedContentPath
  if (isPublished && (!contentType || !authoritativePath)) {
    throw new Error('Digital Product cannot be published before protected content is configured.')
  }
  return {
    content_type: contentType,
    content_path: authoritativePath,
    content_file_name: fileName ?? storedFileName,
    content_mime_type: mimeType ?? storedMimeType,
    content_size_bytes: fileSize ?? storedFileSize,
    is_published: isPublished,
  }
}

export function isDigitalProductSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('digital_products') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}

export function digitalProductMutationError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && String(error.code) === '23505') {
    return 'Slug sudah digunakan oleh Digital Product lain.'
  }
  return formError(error, 'Digital Product belum dapat disimpan. Periksa koneksi lalu coba lagi.')
}
