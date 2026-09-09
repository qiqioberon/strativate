import type { CatalogLifecycleStatus, CatalogProductType } from '@/lib/supabase/database.types'

type FilterableCatalogProduct = {
  code: string
  title: string
  product_type: CatalogProductType
  status: CatalogLifecycleStatus
}

export type CatalogProductFilters = {
  query: string
  productType: CatalogProductType | 'all'
  status: CatalogLifecycleStatus | 'all'
}

export const catalogProductTypeLabels: Record<CatalogProductType, string> = {
  private_mentoring: 'Mentoring Privat',
  intensive_mentoring: 'Mentoring Intensif',
  big_class: 'Kelas Besar',
  digital_product: 'Produk Digital',
}

export const catalogStatusLabels = {
  draft: 'Draf', published: 'Dipublikasikan', archived: 'Diarsipkan',
} as const

export function resolveCatalogProductType(value: unknown, existingType?: CatalogProductType): CatalogProductType {
  if (existingType) return existingType
  if (typeof value === 'string' && value in catalogProductTypeLabels) return value as CatalogProductType
  throw new Error('Jenis produk wajib dipilih.')
}

export function normalizeCatalogCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function normalizeCatalogSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function filterCatalogProducts<T extends FilterableCatalogProduct>(products: T[], filters: CatalogProductFilters) {
  const query = filters.query.trim().toLocaleLowerCase('id-ID')
  return products.filter((product) => {
    const matchesQuery = !query || `${product.title} ${product.code}`.toLocaleLowerCase('id-ID').includes(query)
    const matchesType = filters.productType === 'all' || product.product_type === filters.productType
    const matchesStatus = filters.status === 'all' || product.status === filters.status
    return matchesQuery && matchesType && matchesStatus
  })
}
