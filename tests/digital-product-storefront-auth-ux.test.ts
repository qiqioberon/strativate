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

test('public product list is purchase-aware and uses compact reusable add-to-cart UI', () => {
  assert.match(listPage, /resolveDigitalPurchaseMode\(account\)/)
  assert.match(directory, /<AddToCartButton/)
  assert.match(directory, /compact/)
  assert.match(directory, /digital-product-card__description/)
  assert.match(styles, /grid-template-columns: repeat\(auto-fill, minmax\(260px, 320px\)\)/)
  assert.match(styles, /object-fit: contain/)
})

test('product detail keeps purchase actions contextual and reports cart state through global toast feedback', () => {
  assert.match(detailPage, /resolveDigitalPurchaseMode\(account\)/)
  assert.match(detailPage, /digital-product-detail__purchase/)
  assert.match(detailPage, /purchaseMode === 'mentee'/)
  assert.match(addToCart, /if \(pending\) return/)
  assert.match(addToCart, /useToast/)
  assert.match(addToCart, /Produk berhasil ditambahkan ke keranjang\./)
  assert.match(addToCart, /Produk ini sudah ada di keranjang Anda\./)
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
