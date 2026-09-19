import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('admin dashboard exposes Private Mentoring Catalog, generic Cart Links, and real session operations', () => {
  const admin = read('app/admin/page.tsx')
  assert.match(admin, /Private Mentoring/)
  assert.match(admin, /Cart Links/)
  assert.match(admin, /Mentoring Sessions/)
  assert.match(admin, /PrivateMentoringManagement/)
  assert.match(admin, /CommerceCartLinkManagement/)
  assert.match(admin, /AdminMentoringSessionWorkspace/)
})

test('Private Mentoring admin manages only genuine catalog data, never marketing copy', () => {
  const source = read('components/admin/private-mentoring-management.tsx')
  assert.match(source, /Private Mentoring Catalog/)
  assert.match(source, /private_mentoring_packages/)
  assert.match(source, /private_mentoring_learning_paths/)
  assert.match(source, /private_mentoring_session_focuses/)
  assert.doesNotMatch(source, /competition_categories/)
  assert.doesNotMatch(source, /private_mentoring_programs/)
  assert.doesNotMatch(source, /private_mentoring_highlights/)
  assert.doesNotMatch(source, /private_mentoring_journey_steps/)
  assert.doesNotMatch(source, /short_description|saveProgram|Informasi publik/)
  assert.doesNotMatch(source, /aria-label=[^\n]*(title|kicker|audience|hero|journey|highlight)/i)
})

test('generic cart-link admin UI searches mentees and commerce items without manual UUID or custom price', () => {
  const source = read('components/admin/commerce-cart-link-management.tsx')
  assert.match(source, /list_cart_link_mentees/)
  assert.match(source, /list_admin_cart_link_items/)
  assert.match(source, /Sudah dimiliki/)
  assert.match(source, /role="combobox"/)
  assert.match(source, /api\/admin\/cart-links/)
  assert.match(source, /navigator\.clipboard|copy/i)
  assert.doesNotMatch(source, /placeholder=["'][^"']*uuid/i)
  assert.doesNotMatch(source, /custom.?price|harga khusus/i)
})

test('cart-link application boundary creates random raw tokens and hashes before persistence', () => {
  const source = read('lib/private-mentoring/cart-links.ts')
  assert.match(source, /randomBytes\s*\(\s*32\s*\)/)
  assert.match(source, /sha256/)
  assert.match(source, /create_commerce_cart_link/)
  assert.doesNotMatch(source, /Math\.random/)
})
