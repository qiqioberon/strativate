import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140014_digital_product_content_delivery.sql'
const adminHelpers = readFileSync('lib/digital-products/admin.ts', 'utf8')
const config = readFileSync('lib/digital-products/config.ts', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const addToCart = readFileSync('components/digital-products/add-to-cart-button.tsx', 'utf8')
const cartView = readFileSync('components/commerce/cart-view.tsx', 'utf8')
const userOrderHistory = readFileSync('components/commerce/user-order-history.tsx', 'utf8')
const home = readFileSync('components/marketing/home-page.tsx', 'utf8')
const dashboardPage = readFileSync('app/dashboard/page.tsx', 'utf8')
const dashboardClient = readFileSync('app/dashboard/dashboard-client.tsx', 'utf8')

test('protected Digital Product storage and entitlement migration exists', () => {
  assert.equal(existsSync(migrationPath), true, 'protected-content migration must exist')
})

test('Supabase migration versions remain unique after concurrent feature integration', () => {
  const migrations = readdirSync('supabase/migrations').filter(filename => filename.endsWith('.sql'))
  const versions = migrations.map(filename => filename.split('_')[0])
  assert.equal(new Set(versions).size, versions.length, 'migration numeric prefixes must be unique')
})

test('admin helpers define private PDF/video content validation and paths', () => {
  assert.match(config, /DIGITAL_PRODUCT_CONTENT_BUCKET/)
  assert.match(config, /application\/pdf/)
  assert.match(config, /video\/mp4/)
  assert.match(adminHelpers, /validateDigitalProductContentFile/)
  assert.match(adminHelpers, /buildDigitalProductContentPath/)
})

test('global toast is mounted and cart feedback no longer uses temporary inline state', () => {
  assert.match(layout, /ToastProvider/)
  assert.match(addToCart, /useToast/)
  assert.doesNotMatch(addToCart, /setAdded\(/)
  assert.doesNotMatch(addToCart, /digital-product-inline-cart-link/)
  assert.match(cartView, /useToast/)
})

test('homepage delegates Digital Product previews to the React Bits Card Swap showcase', () => {
  assert.match(home, /DigitalProductCardSwap/)
  assert.doesNotMatch(home, /DigitalProductCarousel/)
  assert.doesNotMatch(home, /digitalProducts\.slice\(0, 2\)/)
})

test('dashboard consumes the shared cart and real Digital Product order history', () => {
  assert.match(dashboardPage, /getActiveCart/)
  assert.match(dashboardPage, /listUserOrders/)
  assert.match(dashboardClient, /label: 'Keranjang'/)
  assert.match(dashboardClient, /UserOrderHistory/)
  assert.match(userOrderHistory, /Lanjutkan Pembayaran/)
})

test('paid library routes into an internal protected reader/player', () => {
  assert.equal(existsSync('app/api/digital-products/[id]/access/route.ts'), true, 'protected access API must exist')
  assert.equal(existsSync('app/dashboard/produk-digital/[id]/page.tsx'), true, 'protected dashboard content route must exist')
  assert.equal(existsSync('components/digital-products/protected-content-viewer.tsx'), true, 'protected viewer must exist')
  assert.match(dashboardClient, /Buka materi|Tonton video/)
})
