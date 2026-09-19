import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const adminPage = readFileSync('app/admin/page.tsx', 'utf8')
const featureFlags = readFileSync('lib/features.ts', 'utf8')
const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')

test('admin navigation exposes Digital Products independently from the public feature flag', () => {
  assert.match(adminPage, /import \{ DigitalProductManagement \} from '@\/components\/admin\/digital-product-management'/)
  assert.match(adminPage, /label: 'Produk'[\s\S]*id: 'Private Mentoring'[\s\S]*id: 'Intensive Mentoring'[\s\S]*id: 'Digital Products'/)
  assert.doesNotMatch(adminPage, /featureFlags\.digitalProducts/)
  assert.match(adminPage, /section === 'Digital Products'[\s\S]*<DigitalProductManagement\s*\/>/)
})

test('public Digital Products rollout has one env-backed runtime decision', () => {
  assert.match(featureFlags, /isDigitalProductsEnabled/)
  assert.match(featureFlags, /process\.env\.FEATURE_DIGITAL_PRODUCTS/)
  assert.doesNotMatch(featureFlags, /digitalProducts:\s*false/)
})

test('Digital Product controller renders protected-media domain fields in a sortable semantic paginated table', () => {
  assert.match(manager, /data-testid="digital-product-table"/)
  for (const label of ['Produk', 'Jenis', 'Harga', 'Status', 'Beranda', 'Materi terlindungi', 'Diperbarui']) assert.match(manager, new RegExp(`SortableTableHeader label="${label}"`))
  assert.match(manager, /product\.slug/)
  assert.match(manager, /product\.content_type/)
  assert.match(manager, /product\.is_published/)
  assert.match(manager, /product\.homepage_featured/)
  assert.match(manager, /homepage_featured_order/)
  assert.match(manager, /data-testid="digital-product-homepage-featured"/)
  assert.match(manager, /data-testid="digital-product-homepage-order"/)
  assert.match(manager, /const sortedProducts = useMemo/)
  assert.match(manager, /const pagedProducts = useMemo/)
  assert.match(manager, /pagedProducts\.map/)
  assert.match(manager, /<TablePagination/)
  assert.match(manager, /totalItems=\{filteredProducts\.length\}/)
  assert.doesNotMatch(manager, /<CatalogManagement/)
})

test('Digital Product create and edit flows open in a native modal dialog', () => {
  assert.match(manager, /useRef<HTMLDialogElement>/)
  assert.match(manager, /dialog\.showModal\(\)/)
  assert.match(manager, /data-testid="digital-product-dialog"/)
  assert.match(manager, /data-testid="digital-product-dialog-close"/)
  assert.match(manager, /onClick=\{\(\) => beginEdit\(product\.id\)\}/)
  assert.match(manager, /onClick=\{beginCreate\}/)
  assert.match(manager, /digital-product-create-mode/)
  assert.match(manager, /digital-product-edit-mode/)
  assert.doesNotMatch(manager, /<div className=\{styles\.singleEditor\}>\{editor\}<\/div>/)
  assert.equal(existsSync('components/admin/digital-product-dialog.module.css'), true)
})

test('Digital Product CRUD and both Storage asset reconciliation paths remain owned by the controller', () => {
  assert.match(manager, /\.from\('digital_products'\)/)
  assert.match(manager, /DIGITAL_PRODUCT_IMAGE_BUCKET/)
  assert.match(manager, /DIGITAL_PRODUCT_CONTENT_BUCKET/)
  assert.match(manager, /\.upload\(uploadedImagePath/)
  assert.match(manager, /\.upload\(uploadedContentPath/)
  assert.match(manager, /\.update\(payload\)/)
  assert.match(manager, /\.insert\(payload\)/)
  assert.match(manager, /\.delete\(\)/)
  assert.match(manager, /\.maybeSingle\(\)/)
  assert.match(manager, /createSignedUrl/)
  assert.match(manager, /\.remove\(\[oldImagePath\]\)/)
  assert.match(manager, /\.remove\(\[uploadedImagePath\]\)/)
  assert.match(manager, /\.remove\(\[uploadedContentPath\]\)/)
})

test('Digital Product zero state remains dedicated onboarding', () => {
  assert.match(manager, /showDedicatedEmptyState/)
  assert.match(manager, /data-testid="digital-product-empty-state"/)
  assert.match(manager, /Belum ada Digital Product/)
  assert.match(manager, /Buat Digital Product/)
})
