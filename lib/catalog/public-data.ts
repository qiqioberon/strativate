import {
  assembleCatalogDetail,
  assembleCatalogSummary,
  type CatalogAddOnApplicabilityRow,
  type CatalogAssemblyRows,
  type CatalogBundleComponentRow,
  type CatalogCommercialItemRow,
  type CatalogDeliveryOptionRow,
  type CatalogDigitalDetailRow,
  type CatalogIntensiveOfferingRow,
  type CatalogItemBenefitRow,
  type CatalogItemSubtypeRow,
  type CatalogPrivateOfferingRow,
  type CatalogProductRow,
} from './assemble'
import type { CatalogProductDetail, CatalogProductSummary } from './types'

export interface CatalogPublicDataSource {
  products(): Promise<CatalogProductRow[]>
  items(productId?: string): Promise<CatalogCommercialItemRow[]>
  privateOfferings(productId?: string): Promise<CatalogPrivateOfferingRow[]>
  intensiveOfferings(productId?: string): Promise<CatalogIntensiveOfferingRow[]>
  deliveryOptions(productId?: string): Promise<CatalogDeliveryOptionRow[]>
  itemBenefits(productId?: string): Promise<CatalogItemBenefitRow[]>
  addOnApplicability(productId?: string): Promise<CatalogAddOnApplicabilityRow[]>
  bundleComponents(productId?: string): Promise<CatalogBundleComponentRow[]>
  digitalDetails(productId?: string): Promise<CatalogDigitalDetailRow[]>
  addOns(productId?: string): Promise<CatalogItemSubtypeRow[]>
  bundles(productId?: string): Promise<CatalogItemSubtypeRow[]>
}

export async function listPublicCatalogFrom(source: CatalogPublicDataSource): Promise<CatalogProductSummary[]> {
  const [products, items] = await Promise.all([source.products(), source.items()])
  return products
    .map((product) => assembleCatalogSummary(product, items))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, 'id'))
}

export async function getPublicCatalogProductFrom(
  source: CatalogPublicDataSource,
  slug: string,
): Promise<CatalogProductDetail | null> {
  const product = (await source.products()).find((candidate) => candidate.slug === slug)
  if (!product) return null

  const [items, privateOfferings, intensiveOfferings, deliveryOptions, itemBenefits,
    addOnApplicability, bundleComponents, digitalDetails, addOns, bundles] = await Promise.all([
    source.items(product.id),
    source.privateOfferings(product.id),
    source.intensiveOfferings(product.id),
    source.deliveryOptions(product.id),
    source.itemBenefits(product.id),
    source.addOnApplicability(product.id),
    source.bundleComponents(product.id),
    source.digitalDetails(product.id),
    source.addOns(product.id),
    source.bundles(product.id),
  ])

  const rows: CatalogAssemblyRows = {
    items, privateOfferings, intensiveOfferings, deliveryOptions, itemBenefits,
    addOnApplicability, bundleComponents, digitalDetails, addOns, bundles,
  }
  return assembleCatalogDetail(product, rows)
}
