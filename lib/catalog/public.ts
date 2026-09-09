import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { getPublicCatalogProductFrom, listPublicCatalogFrom, type CatalogPublicDataSource } from './public-data'
import { postgresTestCatalogSource } from './postgres-test-source'

type PublicViews = Database['public']['Views']
type ViewName = keyof PublicViews
type RawQueryResult = { data: unknown[] | null; error: { message: string } | null }
type RawQuery = PromiseLike<RawQueryResult> & {
  eq(column: 'product_id', value: string): PromiseLike<RawQueryResult>
}

async function rowsFromView<Name extends ViewName>(
  name: Name,
  productId?: string,
): Promise<PublicViews[Name]['Row'][]> {
  const supabase = await createClient()
  const query = supabase.from(name).select('*') as unknown as RawQuery
  const { data, error } = await (productId ? query.eq('product_id', productId) : query)
  if (error) throw new Error(`Gagal membaca Product Master (${String(name)}): ${error.message}`)
  return (data ?? []) as unknown as PublicViews[Name]['Row'][]
}

const publicSource: CatalogPublicDataSource = {
  products: () => rowsFromView('public_catalog_products'),
  items: (productId) => rowsFromView('public_catalog_commercial_items', productId),
  privateOfferings: (productId) => rowsFromView('public_catalog_private_offerings', productId),
  intensiveOfferings: (productId) => rowsFromView('public_catalog_intensive_offerings', productId),
  deliveryOptions: (productId) => rowsFromView('public_catalog_delivery_options', productId),
  itemBenefits: (productId) => rowsFromView('public_catalog_item_benefits', productId),
  addOnApplicability: (productId) => rowsFromView('public_catalog_add_on_applicability', productId),
  bundleComponents: (productId) => rowsFromView('public_catalog_bundle_components', productId),
  digitalDetails: (productId) => rowsFromView('public_catalog_digital_details', productId),
  addOns: (productId) => rowsFromView('public_catalog_add_ons', productId),
  bundles: (productId) => rowsFromView('public_catalog_bundles', productId),
}

export function listPublicCatalog() {
  return listPublicCatalogFrom(process.env.TEST_DATABASE_URL ? postgresTestCatalogSource : publicSource)
}

export function getPublicCatalogProduct(slug: string) {
  return getPublicCatalogProductFrom(process.env.TEST_DATABASE_URL ? postgresTestCatalogSource : publicSource, slug)
}
