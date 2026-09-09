import type {
  CatalogAddOn,
  CatalogBenefit,
  CatalogBundle,
  CatalogCommercialItem,
  CatalogCommercialItemKind,
  CatalogDeliveryOption,
  CatalogDigitalContentType,
  CatalogIntensiveOffering,
  CatalogProductDetail,
  CatalogProductSummary,
  CatalogProductType,
  CatalogPurchaseFlow,
  CatalogPrivateOffering,
} from './types'

export interface CatalogProductRow {
  id: string
  code: string
  slug: string
  product_type: CatalogProductType
  default_purchase_flow: CatalogPurchaseFlow
  title: string
  short_description: string
  description: string | null
  is_featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CatalogCommercialItemRow {
  id: string
  product_id: string
  code: string
  kind: CatalogCommercialItemKind
  title: string
  description: string | null
  pricing_mode: 'fixed' | 'quotation_required'
  price_amount: number | null
  reference_price_amount: number | null
  currency_code: string
  is_sellable: boolean
  sort_order: number
}

export interface CatalogPrivateOfferingRow {
  id: string
  product_id: string
  mentor_tier_id: string
  mentor_tier_code: string
  mentor_tier_label: string
  session_package_id: string
  session_package_code: string
  session_package_label: string
  session_count: number
  per_session_price_amount: number
  session_duration_minutes: number
  min_participants: number
  max_participants: number
}

export interface CatalogIntensiveOfferingRow {
  id: string
  product_id: string
  scope: 'national_fixed' | 'international_custom'
  sessions_per_month: number | null
}

export interface CatalogDeliveryOptionRow {
  id: string
  product_id: string
  kind: 'learning_path' | 'focus_topic'
  code: string
  label: string
  allows_custom_value: boolean
  sort_order: number
}

export interface CatalogItemBenefitRow {
  product_id: string
  item_id: string
  item_code: string
  benefit_id: string
  benefit_code: string
  benefit_label: string
  benefit_description: string | null
  sort_order: number
}

export interface CatalogAddOnApplicabilityRow {
  product_id: string
  add_on_id: string
  offering_id: string
}

export interface CatalogBundleComponentRow {
  product_id: string
  bundle_id: string
  bundle_code: string
  component_kind: 'offering' | 'add_on' | 'benefit'
  component_id: string
  component_code: string
  component_title: string
  quantity: number
}

export interface CatalogDigitalDetailRow {
  product_id: string
  content_type: CatalogDigitalContentType
}

export interface CatalogItemSubtypeRow {
  id: string
  product_id: string
  kind: 'add_on' | 'bundle'
  is_conditional: boolean
  public_condition_summary: string | null
}

export interface CatalogAssemblyRows {
  items: CatalogCommercialItemRow[]
  privateOfferings: CatalogPrivateOfferingRow[]
  intensiveOfferings: CatalogIntensiveOfferingRow[]
  deliveryOptions: CatalogDeliveryOptionRow[]
  itemBenefits: CatalogItemBenefitRow[]
  addOnApplicability: CatalogAddOnApplicabilityRow[]
  bundleComponents: CatalogBundleComponentRow[]
  digitalDetails: CatalogDigitalDetailRow[]
  addOns: CatalogItemSubtypeRow[]
  bundles: CatalogItemSubtypeRow[]
}

export function assembleCommercialItem(row: CatalogCommercialItemRow): CatalogCommercialItem {
  const common = {
    id: row.id,
    productId: row.product_id,
    code: row.code,
    kind: row.kind,
    title: row.title,
    description: row.description,
    currencyCode: 'IDR' as const,
    isSellable: row.is_sellable,
    sortOrder: row.sort_order,
  }

  if (row.pricing_mode === 'quotation_required') {
    return { ...common, pricingMode: 'quotation_required' }
  }
  if (row.price_amount === null) {
    throw new Error(`Offering fixed-price ${row.code} tidak memiliki harga.`)
  }
  return {
    ...common,
    pricingMode: 'fixed',
    priceAmount: row.price_amount,
    referencePriceAmount: row.reference_price_amount,
  }
}

export function assembleCatalogSummary(
  product: CatalogProductRow,
  itemRows: CatalogCommercialItemRow[],
): CatalogProductSummary {
  const productItems = itemRows.filter((item) => item.product_id === product.id && item.is_sellable && item.kind === 'offering')
  const fixedPrices = productItems
    .filter((item) => item.pricing_mode === 'fixed' && item.price_amount !== null)
    .map((item) => item.price_amount as number)

  return {
    id: product.id,
    code: product.code,
    slug: product.slug,
    productType: product.product_type,
    defaultPurchaseFlow: product.default_purchase_flow,
    title: product.title,
    shortDescription: product.short_description,
    description: product.description,
    isFeatured: product.is_featured,
    sortOrder: product.sort_order,
    startingPriceAmount: fixedPrices.length ? Math.min(...fixedPrices) : null,
    hasQuotationPricing: productItems.some((item) => item.pricing_mode === 'quotation_required'),
  }
}

function benefitFromRow(row: CatalogItemBenefitRow): CatalogBenefit {
  return {
    id: row.benefit_id,
    code: row.benefit_code,
    label: row.benefit_label,
    description: row.benefit_description,
    sortOrder: row.sort_order,
  }
}

export function assembleCatalogDetail(
  product: CatalogProductRow,
  rows: CatalogAssemblyRows,
): CatalogProductDetail {
  const itemRows = rows.items.filter((item) => item.product_id === product.id)
  const items = itemRows.map(assembleCommercialItem)
  const itemById = new Map(items.map((item) => [item.id, item]))
  const summary = assembleCatalogSummary(product, itemRows)

  const privateRows = rows.privateOfferings.filter((row) => row.product_id === product.id)
  const privateOfferings = privateRows.flatMap((row): CatalogPrivateOffering[] => {
    const item = itemById.get(row.id)
    if (!item || item.kind !== 'offering' || item.pricingMode !== 'fixed') return []
    return [{
      id: item.id,
      productId: item.productId,
      code: item.code,
      title: item.title,
      pricingMode: 'fixed',
      priceAmount: item.priceAmount,
      referencePriceAmount: item.referencePriceAmount,
      perSessionPriceAmount: row.per_session_price_amount,
      mentorTier: { id: row.mentor_tier_id, code: row.mentor_tier_code, label: row.mentor_tier_label },
      sessionPackage: {
        id: row.session_package_id,
        code: row.session_package_code,
        label: row.session_package_label,
        sessionCount: row.session_count,
      },
    }]
  })

  const intensiveOfferings = rows.intensiveOfferings
    .filter((row) => row.product_id === product.id)
    .flatMap((row): CatalogIntensiveOffering[] => {
      const item = itemById.get(row.id)
      if (!item || item.kind !== 'offering') return []
      return [{
        id: item.id,
        productId: item.productId,
        code: item.code,
        title: item.title,
        scope: row.scope,
        sessionsPerMonth: row.sessions_per_month,
        pricingMode: item.pricingMode,
        ...(item.pricingMode === 'fixed'
          ? { priceAmount: item.priceAmount, referencePriceAmount: item.referencePriceAmount }
          : {}),
      }]
    })

  const deliveryOptions: CatalogDeliveryOption[] = rows.deliveryOptions
    .filter((row) => row.product_id === product.id)
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      kind: row.kind,
      code: row.code,
      label: row.label,
      allowsCustomValue: row.allows_custom_value,
      sortOrder: row.sort_order,
    }))

  const addOns: CatalogAddOn[] = rows.addOns
    .filter((row) => row.product_id === product.id)
    .flatMap((subtype): CatalogAddOn[] => {
      const item = itemById.get(subtype.id)
      if (!item || item.kind !== 'add_on') return []
      return [{
        ...item,
        kind: 'add_on',
        isConditional: subtype.is_conditional,
        publicConditionSummary: subtype.public_condition_summary,
        applicableOfferingIds: rows.addOnApplicability
          .filter((row) => row.add_on_id === item.id)
          .map((row) => row.offering_id),
      }]
    })

  const bundles: CatalogBundle[] = rows.bundles
    .filter((row) => row.product_id === product.id)
    .flatMap((subtype): CatalogBundle[] => {
      const item = itemById.get(subtype.id)
      if (!item || item.kind !== 'bundle') return []
      return [{
        ...item,
        kind: 'bundle',
        isConditional: subtype.is_conditional,
        publicConditionSummary: subtype.public_condition_summary,
        components: rows.bundleComponents
          .filter((row) => row.bundle_id === item.id)
          .map((row) => ({
            kind: row.component_kind,
            id: row.component_id,
            code: row.component_code,
            title: row.component_title,
            quantity: row.quantity,
          })),
        benefits: rows.itemBenefits.filter((row) => row.item_id === item.id).map(benefitFromRow),
      }]
    })

  const privateDetails = privateRows[0]
    ? {
        sessionDurationMinutes: privateRows[0].session_duration_minutes,
        minParticipants: privateRows[0].min_participants,
        maxParticipants: privateRows[0].max_participants,
      }
    : null

  return {
    ...summary,
    commercialItems: items,
    offerings: items.filter((item) => item.kind === 'offering') as CatalogProductDetail['offerings'],
    addOns,
    bundles,
    privateOfferings,
    intensiveOfferings,
    deliveryOptions,
    benefitsByItemId: Object.fromEntries(items.map((item) => [
      item.id,
      rows.itemBenefits.filter((row) => row.item_id === item.id).map(benefitFromRow),
    ])),
    privateDetails,
    digitalDetails: rows.digitalDetails.find((row) => row.product_id === product.id)
      ? { contentType: rows.digitalDetails.find((row) => row.product_id === product.id)!.content_type }
      : null,
  }
}

export type CatalogSort = 'featured' | 'price_asc' | 'price_desc' | 'title'

export function sortCatalogProducts(
  products: CatalogProductSummary[],
  sort: CatalogSort,
): CatalogProductSummary[] {
  return [...products].sort((left, right) => {
    if (sort === 'title') return left.title.localeCompare(right.title, 'id')
    if (sort === 'price_asc') {
      if (left.startingPriceAmount === null) return right.startingPriceAmount === null ? 0 : 1
      if (right.startingPriceAmount === null) return -1
      return left.startingPriceAmount - right.startingPriceAmount
    }
    if (sort === 'price_desc') {
      if (left.startingPriceAmount === null) return right.startingPriceAmount === null ? 0 : 1
      if (right.startingPriceAmount === null) return -1
      return right.startingPriceAmount - left.startingPriceAmount
    }
    return Number(right.isFeatured) - Number(left.isFeatured) || left.sortOrder - right.sortOrder
  })
}
