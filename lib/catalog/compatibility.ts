import { formatRupiah } from './format'
import type { CatalogProductDetail } from './types'

export interface LegacyCheckoutCatalogItem {
  productId: string
  commercialItemId: string
  slug: string
  title: string
  productType: CatalogProductDetail['productType']
  priceAmount: number
  priceLabel: string
}

export function toLegacyCheckoutItem(
  product: CatalogProductDetail,
  commercialItemId: string,
): LegacyCheckoutCatalogItem | null {
  const item = product.commercialItems.find((candidate) => candidate.id === commercialItemId)
  if (!item || item.kind !== 'offering' || !item.isSellable || item.pricingMode !== 'fixed') return null

  return {
    productId: product.id,
    commercialItemId: item.id,
    slug: product.slug,
    title: product.title,
    productType: product.productType,
    priceAmount: item.priceAmount,
    priceLabel: formatRupiah(item.priceAmount),
  }
}
