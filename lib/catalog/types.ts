export type CatalogProductType =
  | 'private_mentoring'
  | 'intensive_mentoring'
  | 'big_class'
  | 'digital_product'

export type CatalogPurchaseFlow = 'consultation_offer' | 'direct_checkout'
export type CatalogCommercialItemKind = 'offering' | 'add_on' | 'bundle'
export type CatalogDeliveryOptionKind = 'learning_path' | 'focus_topic'
export type CatalogIntensiveScope = 'national_fixed' | 'international_custom'
export type CatalogDigitalContentType = 'pdf' | 'video'

interface CatalogCommercialItemBase {
  id: string
  productId: string
  code: string
  kind: CatalogCommercialItemKind
  title: string
  description: string | null
  currencyCode: 'IDR'
  isSellable: boolean
  sortOrder: number
}

export interface FixedPriceCatalogItem extends CatalogCommercialItemBase {
  pricingMode: 'fixed'
  priceAmount: number
  referencePriceAmount: number | null
}

export interface QuotationCatalogItem extends CatalogCommercialItemBase {
  pricingMode: 'quotation_required'
}

export type CatalogCommercialItem =
  | FixedPriceCatalogItem
  | QuotationCatalogItem

export type CatalogOffering = CatalogCommercialItem & { kind: 'offering' }
export type CatalogAddOnItem = CatalogCommercialItem & { kind: 'add_on' }
export type CatalogBundleItem = CatalogCommercialItem & { kind: 'bundle' }

export interface CatalogProductSummary {
  id: string
  code: string
  slug: string
  productType: CatalogProductType
  defaultPurchaseFlow: CatalogPurchaseFlow
  title: string
  shortDescription: string
  description: string | null
  isFeatured: boolean
  sortOrder: number
  startingPriceAmount: number | null
  hasQuotationPricing: boolean
}

export interface CatalogPrivateOffering {
  id: string
  productId: string
  code: string
  title: string
  pricingMode: 'fixed'
  priceAmount: number
  referencePriceAmount: number | null
  perSessionPriceAmount: number
  mentorTier: { id: string; code: string; label: string }
  sessionPackage: { id: string; code: string; label: string; sessionCount: number }
}

export interface CatalogIntensiveOffering {
  id: string
  productId: string
  code: string
  title: string
  scope: CatalogIntensiveScope
  sessionsPerMonth: number | null
  pricingMode: 'fixed' | 'quotation_required'
  priceAmount?: number
  referencePriceAmount?: number | null
}

export interface CatalogDeliveryOption {
  id: string
  productId: string
  kind: CatalogDeliveryOptionKind
  code: string
  label: string
  allowsCustomValue: boolean
  sortOrder: number
}

export interface CatalogBenefit {
  id: string
  code: string
  label: string
  description: string | null
  sortOrder: number
}

export interface CatalogBundleComponent {
  kind: 'offering' | 'add_on' | 'benefit'
  id: string
  code: string
  title: string
  quantity: number
}

export type CatalogAddOn = CatalogAddOnItem & {
  isConditional: boolean
  publicConditionSummary: string | null
  applicableOfferingIds: string[]
}

export type CatalogBundle = CatalogBundleItem & {
  isConditional: boolean
  publicConditionSummary: string | null
  components: CatalogBundleComponent[]
  benefits: CatalogBenefit[]
}

export interface CatalogProductDetail extends CatalogProductSummary {
  commercialItems: CatalogCommercialItem[]
  offerings: CatalogOffering[]
  addOns: CatalogAddOn[]
  bundles: CatalogBundle[]
  privateOfferings: CatalogPrivateOffering[]
  intensiveOfferings: CatalogIntensiveOffering[]
  deliveryOptions: CatalogDeliveryOption[]
  privateDetails: {
    sessionDurationMinutes: number
    minParticipants: number
    maxParticipants: number
  } | null
  digitalDetails: { contentType: CatalogDigitalContentType } | null
}
