import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const marketing = readFileSync('app/marketing.css', 'utf8')
const program = readFileSync('app/program/program-layout-fix.css', 'utf8')
const commerce = readFileSync('app/digital-product-commerce.css', 'utf8')
const productUx = readFileSync('app/digital-product-ux.css', 'utf8')

test('marketing display headings use the relaxed shared rhythm', () => {
  assert.match(marketing, /--marketing-display-tracking:\s*-\.045em/)
  assert.match(marketing, /\.marketing-page-intro h1[\s\S]*letter-spacing:\s*var\(--marketing-display-tracking\)[\s\S]*line-height:\s*1\.02/)
  assert.match(marketing, /\.editorial-hero h1, \.editorial-detail h1[\s\S]*line-height:\s*1\.02/)
  assert.match(marketing, /\.about-reference-hero h1[\s\S]*line-height:\s*1\.02/)
  assert.match(marketing, /\.faq-reference-hero h1[\s\S]*line-height:\s*1\.02/)
  assert.match(marketing, /\.homepage-hero \.marketing-hero__headline[\s\S]*letter-spacing:\s*-\.045em[\s\S]*line-height:\s*1\.02/)
  assert.match(program, /\.program-page \.marketing-page-intro h1[\s\S]*letter-spacing:\s*-\.045em[\s\S]*line-height:\s*1\.02/)
})

test('landing page surfaces, filters, and empty states stay compact and polished', () => {
  assert.match(marketing, /\.stakeholder-homepage \{[^}]*background:\s*var\(--marketing-surface-warm\)/)
  assert.match(marketing, /\.about-reference-vision \{[\s\S]*border-radius:\s*28px[\s\S]*box-shadow:/)
  assert.match(marketing, /\.editorial-filterbar \{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/)
  assert.match(marketing, /\.editorial-filterbar label:focus-within/)
  assert.match(marketing, /\.editorial-empty \{[^}]*min-height:\s*168px/)
  assert.match(productUx, /\.digital-product-directory__toolbar \{[^}]*flex-wrap:\s*wrap/)
  assert.match(productUx, /\.digital-product-directory__toolbar label:focus-within/)
})

test('program card spacing and homepage product navigation stay intentionally tight', () => {
  assert.match(program, /marketing-service-card--primary \.marketing-service-card__copy,[\s\S]*marketing-service-card--secondary \.marketing-service-card__copy \{\s*margin-top:\s*24px/)
  assert.match(commerce, /digital-product-card-swap__arrow--previous \{ left:\s*max\(8px, calc\(50% - 248px\)\)/)
  assert.match(commerce, /digital-product-card-swap__arrow--next \{ right:\s*max\(8px, calc\(50% - 248px\)\)/)
})
