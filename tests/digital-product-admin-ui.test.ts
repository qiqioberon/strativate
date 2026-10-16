import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const adminPage = readFileSync('app/admin/page.tsx', 'utf8')
const featureFlags = readFileSync('lib/features.ts', 'utf8')
const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/202610170001_digital_product_cover_crop_sources.sql', 'utf8')
const productConfig = readFileSync('lib/digital-products/config.ts', 'utf8')

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

test('Digital Product cover uses the shared upload, crop, and private-original workflow', () => {
  assert.match(manager, /<AdminImageUploadField image=\{cover\} target=\{coverTarget\}/)
  assert.match(manager, /useAdminImageUpload\(\{ supabase, target: coverTarget/)
  assert.match(manager, /data-testid="digital-product-cover-preview"/)
  assert.match(manager, /persistAdminImage\(\{/)
  assert.match(manager, /derivativeBucket: DIGITAL_PRODUCT_IMAGE_BUCKET/)
  assert.match(manager, /sourcePrefix: DIGITAL_PRODUCT_COVER_SOURCE_PREFIX/)
  assert.match(manager, /image_source_path: refs\.sourcePath/)
  assert.match(manager, /image_crop: cover\.crop/)
  assert.match(manager, /sourcePath=\{selected\?\.image_source_path\}/)
  assert.match(manager, /supabase\.rpc\('admin_list_digital_products'\)/)
  assert.match(manager, /PHOTO_SOURCE_BUCKET\)\.remove\(\[product\.image_source_path\]\)/)
  assert.doesNotMatch(manager, /ImageFitEditor|fitImageToWebP/)
  assert.match(productConfig, /DIGITAL_PRODUCT_COVER_SOURCE_PREFIX = 'digital-products\/'/)
  assert.match(productConfig, /DIGITAL_PRODUCT_COVER_WIDTH\s*=\s*1000/)
  assert.match(productConfig, /DIGITAL_PRODUCT_COVER_HEIGHT\s*=\s*1250/)
})

test('Digital Product cover sources stay private while public reads use explicit columns', () => {
  assert.match(migration, /add column if not exists image_source_path text/)
  assert.match(migration, /add column if not exists image_crop jsonb/)
  assert.match(migration, /'about-us',\s*'digital-products'/)
  assert.match(migration, /revoke select on public\.digital_products from anon, authenticated/)
  assert.doesNotMatch(migration.match(/grant select \(([\s\S]*?)\) on public\.digital_products/)?.[1] ?? '', /image_source_path|image_crop/)
  assert.match(migration, /function public\.admin_list_digital_products\(\)/)
  assert.doesNotMatch(readFileSync('lib/commerce/server.ts', 'utf8'), /from\('digital_products'\)\s*\.select\('\*'\)/)
  assert.doesNotMatch(readFileSync('components/admin/discount-code-management.tsx', 'utf8'), /from\('digital_products'\)\.select\('\*'\)/)
})

test('Digital Product CRUD and both Storage asset reconciliation paths remain owned by the controller', () => {
  assert.match(manager, /\.from\('digital_products'\)/)
  assert.match(manager, /DIGITAL_PRODUCT_IMAGE_BUCKET/)
  assert.match(manager, /DIGITAL_PRODUCT_CONTENT_BUCKET/)
  assert.match(manager, /\.upload\(path, file/)
  assert.match(manager, /\.upload\(uploadedContentPath/)
  assert.match(manager, /\.update\(payload\)/)
  assert.match(manager, /\.insert\(payload\)/)
  assert.match(manager, /\.delete\(\)/)
  assert.match(manager, /reconcile: async \(\) =>/)
  assert.match(manager, /\.remove\(\[path\]\)/)
  assert.match(manager, /\.remove\(\[uploadedContentPath\]\)/)
})

test('Digital Product zero state remains dedicated onboarding', () => {
  assert.match(manager, /showDedicatedEmptyState/)
  assert.match(manager, /data-testid="digital-product-empty-state"/)
  assert.match(manager, /Belum ada Digital Product/)
  assert.match(manager, /Buat Digital Product/)
})
