import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202609190003_homepage_digital_product_showcase.sql', 'utf8')
const server = readFileSync('lib/commerce/server.ts', 'utf8')
const page = readFileSync('app/page.tsx', 'utf8')
const manager = readFileSync('components/admin/digital-product-management.tsx', 'utf8')
const cardSwap = readFileSync('components/marketing/card-swap.tsx', 'utf8')
const productSwap = readFileSync('components/marketing/digital-product-card-swap.tsx', 'utf8')

test('homepage showcase schema is additive, ordered, and admin-writable', () => {
  assert.match(migration, /add column homepage_featured boolean not null default false/i)
  assert.match(migration, /add column homepage_featured_order integer not null default 0/i)
  assert.match(migration, /homepage_featured_order between 0 and 9999/i)
  assert.match(migration, /where homepage_featured and is_published/i)
  assert.match(migration, /grant insert \(homepage_featured, homepage_featured_order\)/i)
  assert.match(migration, /update \(homepage_featured, homepage_featured_order\)/i)
})

test('homepage query only loads published products selected by admin in configured order', () => {
  assert.match(server, /function listHomepageDigitalProducts/)
  assert.match(server, /\.eq\('is_published', true\)/)
  assert.match(server, /\.eq\('homepage_featured', true\)/)
  assert.match(server, /\.order\('homepage_featured_order', \{ ascending: true \}\)/)
  assert.match(server, /\.limit\(limit\)/)
  assert.match(page, /listHomepageDigitalProducts\(\)/)
})

test('admin editor owns homepage selection and order', () => {
  assert.match(manager, /data-testid="digital-product-homepage-featured"/)
  assert.match(manager, /data-testid="digital-product-homepage-order"/)
  assert.match(manager, /homepage_featured:\s*draft\.homepageFeatured/)
  assert.match(manager, /homepage_featured_order:/)
  assert.match(manager, /SortableTableHeader label="Beranda"/)
})

test('homepage product showcase uses the GSAP Card Swap interaction', () => {
  assert.match(cardSwap, /import gsap from 'gsap'/)
  assert.match(cardSwap, /y:\s*'\+=500'/)
  assert.match(cardSwap, /slotFor\(position, cardDistance, verticalDistance, total\)/)
  assert.match(cardSwap, /window\.setInterval\(swap, delay\)/)
  assert.match(cardSwap, /prefers-reduced-motion/)
  assert.match(productSwap, /<CardSwap/)
  assert.match(productSwap, /delay=\{3200\}/)
  assert.match(productSwap, /digital-product-card-swap__dots/)
  assert.match(productSwap, /ChevronLeft/)
  assert.match(productSwap, /ChevronRight/)
  assert.match(productSwap, /aria-label="Previous digital product"/)
  assert.match(productSwap, /aria-label="Next digital product"/)
  assert.match(productSwap, /products\.length > 1/)
  assert.match(productSwap, /setRequestedIndex\(previousIndex\)/)
  assert.match(productSwap, /setRequestedIndex\(nextIndex\)/)
  assert.match(productSwap, /aria-current=\{activeIndex === index/)
  assert.match(productSwap, /onClick=\{\(\) => setRequestedIndex\(index\)\}/)
  assert.match(productSwap, /setActiveIndex\(index\)[\s\S]*setRequestedIndex\(index\)/)
  assert.match(cardSwap, /activeIndex\?: number/)
  assert.match(cardSwap, /navigateRef\.current\(activeIndex\)/)
  assert.match(cardSwap, /manual-promote/)
  assert.match(cardSwap, /timeline\.to\(frontElement,[\s\S]*y:\s*'\+=420'/)
  assert.match(cardSwap, /drop:\.75/)
  assert.match(cardSwap, /delay = 3200/)
})
