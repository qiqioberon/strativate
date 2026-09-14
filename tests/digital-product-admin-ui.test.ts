import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminPage = readFileSync('app/admin/page.tsx', 'utf8')
const featureFlags = readFileSync('lib/features.ts', 'utf8')

test('admin navigation exposes Digital Products independently from the public feature flag', () => {
  assert.match(adminPage, /import \{ DigitalProductManagement \} from '@\/components\/admin\/digital-product-management'/)
  assert.match(adminPage, /\{ label: 'Produk', items: \['Digital Products'\] \}/)
  assert.doesNotMatch(adminPage, /featureFlags\.digitalProducts/)
  assert.match(adminPage, /section === 'Digital Products'[\s\S]*<DigitalProductManagement \/>/)
})

test('public Digital Products feature remains disabled', () => {
  assert.match(featureFlags, /digitalProducts:\s*false/)
})

test('Digital Product controller owns Supabase CRUD and reuses CatalogManagement only as presentation', () => {
  const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')
  const shell = readFileSync('components/admin/catalog-management.tsx', 'utf8')

  assert.match(manager, /<CatalogManagement/)
  assert.match(manager, /\.from\('digital_products'\)/)
  assert.match(manager, /DIGITAL_PRODUCT_IMAGE_BUCKET/)
  assert.match(manager, /data-testid="digital-product-management"/)
  assert.match(manager, /digital-product-create-mode/)
  assert.match(manager, /digital-product-edit-mode/)
  assert.doesNotMatch(shell, /createClient|digital_products|DIGITAL_PRODUCT_IMAGE_BUCKET/)
})

test('Digital Product zero state is a dedicated onboarding surface instead of an empty list/editor shell', () => {
  const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')

  assert.match(manager, /showDedicatedEmptyState/)
  assert.match(manager, /data-testid="digital-product-empty-state"/)
  assert.match(manager, /Belum ada Digital Product/)
  assert.match(manager, /Buat Digital Product/)
  assert.match(manager, /Storefront belum aktif/)
})

test('CatalogManagement supports Digital Product-specific navigator wording without owning domain behavior', () => {
  const shell = readFileSync('components/admin/catalog-management.tsx', 'utf8')

  assert.match(shell, /listLabel\?: string/)
  assert.match(shell, /itemNoun\?: string/)
  assert.match(shell, /searchLabel\?: string/)
  assert.match(shell, /searchPlaceholder\?: string/)
  assert.match(shell, /listLabel = 'Semua item'/)
  assert.match(shell, /itemNoun = 'item'/)
  assert.doesNotMatch(shell, /createClient|digital_products|DIGITAL_PRODUCT_IMAGE_BUCKET/)
})