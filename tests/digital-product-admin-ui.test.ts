import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminPage = readFileSync('app/admin/page.tsx', 'utf8')
const featureFlags = readFileSync('lib/features.ts', 'utf8')
const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')

test('admin navigation exposes Digital Products independently from the public feature flag', () => {
  assert.match(adminPage, /import \{ DigitalProductManagement \} from '@\/components\/admin\/digital-product-management'/)
  assert.match(adminPage, /\{ label: 'Produk', items: \['Digital Products'\] \}/)
  assert.doesNotMatch(adminPage, /featureFlags\.digitalProducts/)
  assert.match(adminPage, /section === 'Digital Products'[\s\S]*<DigitalProductManagement \/>/)
})

test('public Digital Products feature remains disabled', () => {
  assert.match(featureFlags, /digitalProducts:\s*false/)
})

test('Digital Product controller renders its real domain fields in a semantic table', () => {
  assert.match(manager, /data-testid="digital-product-table"/)
  assert.match(manager, /<th scope="col">Produk<\/th>/)
  assert.match(manager, /<th scope="col">Slug<\/th>/)
  assert.match(manager, /<th scope="col">Harga<\/th>/)
  assert.match(manager, /<th scope="col">Cover<\/th>/)
  assert.match(manager, /<th scope="col">Terakhir diperbarui<\/th>/)
  assert.match(manager, /filteredProducts\.map/)
  assert.doesNotMatch(manager, /<CatalogManagement/)
  assert.doesNotMatch(manager, /<th scope="col">(?:Tipe|Jenis|Kategori)<\/th>/i)
  assert.doesNotMatch(manager, /product\.(?:type|category)/i)
})

test('Digital Product search and row management keep create/edit flow reachable', () => {
  assert.match(manager, /const filteredProducts = useMemo/)
  assert.match(manager, /Cari produk/)
  assert.match(manager, /onClick=\{\(\) => beginEdit\(product\.id\)\}/)
  assert.match(manager, /onClick=\{beginCreate\}/)
  assert.match(manager, /digital-product-create-mode/)
  assert.match(manager, /digital-product-edit-mode/)
})

test('Digital Product CRUD and Storage reconciliation safety remain owned by the controller', () => {
  assert.match(manager, /\.from\('digital_products'\)/)
  assert.match(manager, /DIGITAL_PRODUCT_IMAGE_BUCKET/)
  assert.match(manager, /\.upload\(uploadedPath/)
  assert.match(manager, /\.update\(payload\)/)
  assert.match(manager, /\.insert\(payload\)/)
  assert.match(manager, /\.delete\(\)/)
  assert.match(manager, /\.maybeSingle\(\)/)
  assert.match(manager, /createSignedUrl/)
  assert.match(manager, /\.remove\(\[oldImagePath\]\)/)
  assert.match(manager, /\.remove\(\[uploadedPath\]\)/)
})

test('Digital Product zero state remains dedicated onboarding', () => {
  assert.match(manager, /showDedicatedEmptyState/)
  assert.match(manager, /data-testid="digital-product-empty-state"/)
  assert.match(manager, /Belum ada Digital Product/)
  assert.match(manager, /Buat Digital Product/)
  assert.match(manager, /Storefront belum aktif/)
})
