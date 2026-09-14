import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => {
  const full = path
  assert.equal(existsSync(full), true, `${path} must exist`)
  return readFileSync(full, 'utf8')
}

test('dashboard operations revision removes redundant navigation and wires real commerce views', () => {
  const user = read('app/dashboard/dashboard-client.tsx')
  assert.doesNotMatch(user, /Program saya|id: 'programs'/i)
  assert.match(user, /UserOrderHistory/)
  assert.match(user, /ownedDigitalProducts/)
  assert.match(user, /privateMentoringSessions/)

  const admin = read('app/admin/page.tsx')
  assert.doesNotMatch(admin, /Mentor Assignment|Bookings|Payments/)
  assert.match(admin, /AdminCommerceOperations/)
})

test('checkout invalidates converted cart and cart checkout expose context-aware back navigation', () => {
  const action = read('app/cart/actions.ts')
  assert.match(action, /revalidatePath\('\/cart'\)/)
  assert.match(action, /revalidatePath\('\/dashboard'\)/)
  assert.match(read('components/commerce/cart-view.tsx'), /ContextBackButton/)
  assert.match(read('app/checkout/page.tsx'), /ContextBackButton/)
})

test('order details, reports, cart links, mentoring sessions, and institutions use requested interaction patterns', () => {
  const userOrders = read('components/commerce/user-order-history.tsx')
  assert.match(userOrders, /<dialog/)
  assert.match(userOrders, /Lihat detail/i)
  assert.match(userOrders, /Lanjutkan pembayaran/i)

  const adminOps = read('components/admin/commerce-operations.tsx')
  assert.match(adminOps, /TablePagination/)
  assert.match(adminOps, /buildCommerceCsv/)
  assert.match(adminOps, /<dialog/)

  const cartLinks = read('components/admin/commerce-cart-link-management.tsx')
  assert.match(cartLinks, /Pilih Mentee/)
  assert.match(cartLinks, /Lihat detail/i)
  assert.match(cartLinks, /TablePagination/)

  const institutions = read('components/admin/institutions.tsx')
  assert.match(institutions, /TablePagination/)
  assert.match(institutions, /Plus/)

  const sessions = read('components/admin/private-mentoring-session-management.tsx')
  assert.match(sessions, /Session Information/)
  assert.match(sessions, /Mentor Assignment/)
  assert.match(sessions, /Schedule/)
  assert.match(sessions, /Status \/ Action/)
})

test('admin commerce migration is guarded and reads shared commerce plus payment attempts', () => {
  const migration = read('supabase/migrations/202609150001_admin_commerce_operations.sql')
  assert.match(migration, /public\.is_admin\(\)/)
  assert.match(migration, /public\.orders/)
  assert.match(migration, /public\.order_items/)
  assert.match(migration, /public\.payment_attempts/)
  assert.match(migration, /list_admin_commerce_orders/)
  assert.match(migration, /get_admin_commerce_report/)
  assert.match(migration, /list_admin_cart_links_page/)
})

test('admin operations UI contains wide cards, stable table/dialog containment, and no support heading', () => {
  const admin = read('app/admin/page.tsx')
  const css = read('app/admin-layout-fixes.css')
  const privateMentoring = read('components/admin/private-mentoring-management.tsx')

  assert.doesNotMatch(admin, /Bantuan &amp; dukungan|Bantuan & dukungan/)
  assert.match(admin, /DashboardSidebarUtilities/)
  assert.match(css, /\.ops-page \.role-card\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?\}/)
  assert.match(css, /\.ops-metric > strong\s*\{[\s\S]*?white-space:\s*nowrap[\s\S]*?\}/)
  assert.match(css, /\.ops-table-section\s*\{[\s\S]*?width:\s*100%[\s\S]*?\}/)
  assert.match(css, /\.ops-dialog\s*\{[\s\S]*?position:\s*fixed[\s\S]*?margin:\s*auto[\s\S]*?\}/)
  assert.match(privateMentoring, /private-mentoring-admin-page/)
  assert.match(css, /\.private-mentoring-admin-page \.unassigned-row\s*\{[\s\S]*?display:\s*grid[\s\S]*?\}/)
})
