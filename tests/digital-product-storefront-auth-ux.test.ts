import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { resolveDigitalPurchaseMode } from '../lib/commerce/purchase-mode'

const shell = readFileSync('components/marketing/marketing-shell.tsx', 'utf8')
const header = readFileSync('components/marketing/site-header.tsx', 'utf8')
const listPage = readFileSync('app/produk-digital/page.tsx', 'utf8')
const directory = readFileSync('components/digital-products/digital-product-directory.tsx', 'utf8')
const detailPage = readFileSync('app/produk-digital/[slug]/page.tsx', 'utf8')
const addToCart = readFileSync('components/digital-products/add-to-cart-button.tsx', 'utf8')
const dashboard = readFileSync('app/dashboard/dashboard-client.tsx', 'utf8')
const userOrderHistory = readFileSync('components/commerce/user-order-history.tsx', 'utf8')
const styles = readFileSync('app/digital-product-ux.css', 'utf8')
const operationsStyles = readFileSync('app/operations-dashboard.css', 'utf8')

test('digital purchase mode preserves existing completed-Mentee eligibility rules', () => {
  assert.equal(resolveDigitalPurchaseMode(null), 'anonymous')
  assert.equal(resolveDigitalPurchaseMode({ profile: { role: 'admin' }, mentee: null }), 'unavailable')
  assert.equal(resolveDigitalPurchaseMode({ profile: { role: 'mentee' }, mentee: { onboarding_completed_at: null } }), 'unavailable')
  assert.equal(resolveDigitalPurchaseMode({ profile: { role: 'mentee' }, mentee: { onboarding_completed_at: '2026-09-14T00:00:00Z' } }), 'mentee')
})

test('marketing shell derives authenticated destinations on the server', () => {
  assert.match(shell, /const account = await getAccount\(\)/)
  assert.match(shell, /accountHref=\{account\?\.destination \?\? null\}/)
  assert.match(shell, /account\?\.profile\.role === 'mentee'/)
})

test('anonymous and authenticated header actions are mutually exclusive and role-aware', () => {
  assert.match(header, /authenticated && accountHref/)
  assert.match(header, /data-testid="desktop-dashboard-link"/)
  assert.match(header, /data-testid="mobile-dashboard-link"/)
  assert.match(header, /data-testid="desktop-login-link"/)
  assert.match(header, /data-testid="mobile-login-link"/)
  assert.match(header, /href="\/auth"[\s\S]{0,180}data-testid="desktop-start-learning-link"/)
  assert.match(header, /href="\/auth"[\s\S]{0,220}data-testid="mobile-start-learning-link"/)
  assert.match(header, /data-testid="mobile-cart-link"/)
  assert.match(header, /ShoppingCart/)
})

test('public product list is image-first and reveals a compact preview on hover or focus', () => {
  assert.doesNotMatch(listPage, /resolveDigitalPurchaseMode|getAccount/)
  assert.doesNotMatch(directory, /<AddToCartButton|digital-product-card__description/)
  assert.match(directory, /digital-product-card__cover/)
  assert.match(directory, /digital-product-card__overlay/)
  assert.match(directory, /digital-product-card__description-preview/)
  assert.match(directory, /\{product\.description\}/)
  assert.match(directory, /formatRupiah\(product\.price_amount\)/)
  assert.match(directory, /View details/)
  assert.match(styles, /grid-template-columns: repeat\(auto-fill, minmax\(260px, 320px\)\)/)
  assert.match(styles, /\.digital-product-card\s*\{[\s\S]*aspect-ratio:\s*4 \/ 5/)
  assert.match(styles, /\.digital-product-card__cover img\s*\{[\s\S]*object-fit:\s*cover/)
  assert.match(styles, /width:\s*min\(100%,\s*320px\)/)
  assert.match(styles, /\.digital-product-card__format\s*\{[\s\S]*color:\s*var\(--marketing-orange\)/)
  assert.match(styles, /\.marketing-products-directory \.digital-product-card__description-preview\s*\{[\s\S]*color:\s*#fff[\s\S]*font-weight:\s*550[\s\S]*-webkit-line-clamp:\s*3/)
  assert.match(styles, /\.marketing-products-directory p\s*\{[\s\S]*color:\s*var\(--marketing-muted\)/)
  assert.match(styles, /\.digital-product-card__overlay\s*\{[\s\S]*background:\s*rgba\(28,28,28,\.62\)[\s\S]*opacity:\s*0/)
  assert.doesNotMatch(styles, /linear-gradient\(180deg, rgba\(28,14,7,0\)/)
  assert.match(styles, /\.digital-product-card:hover \.digital-product-card__overlay,[\s\S]*\.digital-product-card:focus-within \.digital-product-card__overlay\s*\{[\s\S]*opacity:\s*1/)
})

test('product detail keeps purchase actions contextual and reports cart state through global toast feedback', () => {
  assert.match(detailPage, /resolveDigitalPurchaseMode\(account\)/)
  assert.match(detailPage, /digital-product-detail__purchase/)
  assert.match(detailPage, /purchaseMode === 'mentee'/)
  assert.match(addToCart, /if \(pending\) return/)
  assert.match(addToCart, /useToast/)
  assert.match(addToCart, /Product added to your cart\./)
  assert.match(addToCart, /This product is already in your cart\./)
  assert.match(addToCart, /get_active_digital_product_order/)
  assert.match(addToCart, /dialog\.showModal\(\)/)
  assert.match(addToCart, /Produk ini masih memiliki pembayaran aktif/)
  assert.match(addToCart, />\s*Ya\s*</)
  assert.match(addToCart, />\s*Tidak\s*</)
  assert.match(addToCart, /router\.push/)
  assert.match(addToCart, /checkout\?order=/)
  assert.doesNotMatch(addToCart, /setAdded\(/)
  assert.doesNotMatch(addToCart, /digital-product-inline-cart-link/)
})

test('dashboard keeps owned-content behavior while compacting library and order history', () => {
  assert.match(dashboard, /Produk Digital Saya/)
  assert.match(dashboard, /Riwayat pesanan Anda/)
  assert.match(dashboard, /UserOrderHistory/)
  assert.match(userOrderHistory, /data-testid="user-order-table"/)
  assert.doesNotMatch(dashboard, /id: 'explore'/)
  assert.match(styles, /\.workspace \.resource-card-cover/)
  assert.match(operationsStyles, /\.user-order-table/)
})
