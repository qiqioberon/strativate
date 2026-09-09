import 'server-only'
import { Pool } from 'pg'
import type { CatalogPublicDataSource } from './public-data'

const connectionString = process.env.TEST_DATABASE_URL
const pool = connectionString ? new Pool({ connectionString, max: 3 }) : null

async function rows(table: string, productId?: string) {
  if (!pool) throw new Error('TEST_DATABASE_URL tidak dikonfigurasi.')
  const result = productId
    ? await pool.query(`select * from public.${table} where product_id = $1`, [productId])
    : await pool.query(`select * from public.${table}`)
  return result.rows
}

// Adapter ini hanya aktif saat pengujian integrasi lokal. Datanya tetap dibaca
// dari view Product Master yang sama; tidak ada fixture komersial kedua.
export const postgresTestCatalogSource: CatalogPublicDataSource = {
  products: () => rows('public_catalog_products'),
  items: (id) => rows('public_catalog_commercial_items', id),
  privateOfferings: (id) => rows('public_catalog_private_offerings', id),
  intensiveOfferings: (id) => rows('public_catalog_intensive_offerings', id),
  deliveryOptions: (id) => rows('public_catalog_delivery_options', id),
  itemBenefits: (id) => rows('public_catalog_item_benefits', id),
  addOnApplicability: (id) => rows('public_catalog_add_on_applicability', id),
  bundleComponents: (id) => rows('public_catalog_bundle_components', id),
  digitalDetails: (id) => rows('public_catalog_digital_details', id),
  addOns: (id) => rows('public_catalog_add_ons', id),
  bundles: (id) => rows('public_catalog_bundles', id),
}
