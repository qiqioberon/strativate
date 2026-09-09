import type { AssetKey } from '@/lib/content/asset-registry'
import { getProgramEditorial } from '@/lib/program-information'
import { formatRupiah } from './format'
import type {
  CatalogProductDetail,
  CatalogProductSummary,
  CatalogProductType,
  FixedPriceCatalogItem,
} from './types'

export type CatalogMarketingProgram = {
  id: string
  number: string
  title: string
  kicker: string
  description: string
  highlights: readonly string[]
  priceLabel: string
  priceContext: string
  href: string
  assetKey: AssetKey
  status: 'approved'
  tone: 'orange' | 'red' | 'yellow'
}

export type CatalogMarketingDigitalProduct = {
  id: string
  eyebrow: string
  title: string
  description: string
  priceLabel: string
  href: string
  cover: AssetKey
}

export type FixedCatalogOffering = FixedPriceCatalogItem & { kind: 'offering' }

export const catalogProductTypeLabels: Record<CatalogProductType, string> = {
  private_mentoring: 'Mentoring Privat',
  intensive_mentoring: 'Mentoring Intensif',
  big_class: 'Big Class',
  digital_product: 'Produk Digital',
}

const programPresentation: Record<Exclude<CatalogProductType, 'digital_product'>, {
  assetKey: AssetKey
  tone: CatalogMarketingProgram['tone']
}> = {
  private_mentoring: { assetKey: 'programs.private.cover', tone: 'orange' },
  intensive_mentoring: { assetKey: 'programs.intensive.cover', tone: 'red' },
  big_class: { assetKey: 'programs.bigClass.cover', tone: 'yellow' },
}

const digitalCovers: AssetKey[] = [
  'products.guide.cover',
  'products.template.cover',
  'products.workbook.cover',
]

function byCatalogOrder(left: CatalogProductSummary, right: CatalogProductSummary) {
  return left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, 'id')
}

export function catalogPriceLabel(product: CatalogProductSummary) {
  if (product.startingPriceAmount !== null) return `Mulai ${formatRupiah(product.startingPriceAmount)}`
  return product.hasQuotationPricing ? 'Sesuai konsultasi' : 'Segera hadir'
}

export function selectHomepagePrograms(products: CatalogProductSummary[]) {
  return products
    .filter(product => product.productType !== 'digital_product' && product.isFeatured)
    .sort(byCatalogOrder)
}

export function selectProgramDirectory(products: CatalogProductSummary[]) {
  return products.filter(product => product.productType !== 'digital_product').sort(byCatalogOrder)
}

export function selectDigitalProducts(products: CatalogProductSummary[]) {
  return products.filter(product => product.productType === 'digital_product').sort(byCatalogOrder)
}

export function toMarketingProgram(product: CatalogProductSummary, index: number): CatalogMarketingProgram {
  if (product.productType === 'digital_product') {
    throw new Error('Produk digital tidak dapat dipetakan sebagai kartu program.')
  }
  const presentation = programPresentation[product.productType]
  const editorial = getProgramEditorial(product.code)
  return {
    id: product.id,
    number: String(index + 1).padStart(2, '0'),
    title: product.title,
    kicker: editorial?.kicker ?? catalogProductTypeLabels[product.productType],
    description: product.shortDescription,
    highlights: editorial?.highlights ?? [],
    priceLabel: catalogPriceLabel(product),
    priceContext: product.defaultPurchaseFlow === 'consultation_offer'
      ? 'Pilih kebutuhanmu bersama tim Strativate'
      : 'Pembelian langsung',
    href: `/program/${product.slug}`,
    assetKey: presentation.assetKey,
    status: 'approved',
    tone: presentation.tone,
  }
}

export function toMarketingDigitalProduct(
  product: CatalogProductSummary,
  index: number,
): CatalogMarketingDigitalProduct {
  if (product.productType !== 'digital_product') {
    throw new Error('Hanya Produk Digital yang dapat dipetakan ke kartu produk digital.')
  }
  return {
    id: product.id,
    eyebrow: catalogProductTypeLabels.digital_product,
    title: product.title,
    description: product.shortDescription,
    priceLabel: catalogPriceLabel(product),
    href: `/program/${product.slug}`,
    cover: digitalCovers[index % digitalCovers.length],
  }
}

export function directCheckoutOfferings(product: CatalogProductDetail): FixedCatalogOffering[] {
  if (product.defaultPurchaseFlow !== 'direct_checkout') return []
  return product.offerings.flatMap((offering) => (
    offering.isSellable && offering.pricingMode === 'fixed'
      ? [offering as FixedCatalogOffering]
      : []
  ))
}
