import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const cardSwap = readFileSync('components/marketing/card-swap.tsx', 'utf8')
const productSwap = readFileSync('components/marketing/digital-product-card-swap.tsx', 'utf8')
const home = readFileSync('components/marketing/home-page.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const commerceCss = readFileSync('app/digital-product-commerce.css', 'utf8')
const polishPath = 'app/marketing-mobile-product-polish.css'
const polish = existsSync(polishPath) ? readFileSync(polishPath, 'utf8') : ''

test('Digital Product homepage uses the React Bits Card Swap mechanic with five-second rotation', () => {
  assert.match(cardSwap, /import gsap from 'gsap'/)
  assert.match(cardSwap, /y:\s*'\+=500'/)
  assert.match(cardSwap, /perspective|slotFor/)
  assert.match(productSwap, /delay=\{5000\}/)
  assert.match(productSwap, /pauseOnHover/)
  assert.match(productSwap, /href=\{\`\/produk-digital\/\$\{product\.slug\}\`\}/)
  assert.match(productSwap, /data-testid=\{\`digital-product-detail-link-\$\{product\.slug\}\`\}/)
})

test('Digital Product homepage section pairs editorial copy with a storefront CTA and Card Swap', () => {
  assert.match(home, /marketing-product-library__grid/)
  assert.match(home, /marketing-product-library__copy/)
  assert.match(home, /id="digital-products-heading"/)
  assert.match(home, /href="\/produk-digital"/)
  assert.match(home, /data-testid="homepage-products-cta"/)
  assert.match(home, /DigitalProductCardSwap/)
  assert.doesNotMatch(home, /DigitalProductCarousel/)
})

test('Card Swap has a contained responsive stage instead of carousel arrows and dots', () => {
  assert.match(commerceCss, /\.digital-product-card-swap\s*\{[\s\S]*?position:\s*relative[\s\S]*?min-height:/)
  assert.match(commerceCss, /\.rb-card-swap\s*\{[\s\S]*?perspective:\s*900px/)
  assert.match(commerceCss, /\.rb-card-swap__card\s*\{[\s\S]*?transform-style:\s*preserve-3d/)
  assert.match(commerceCss, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.rb-card-swap/)
  assert.doesNotMatch(productSwap, /ArrowLeft|ArrowRight|__dots/)
})

test('Digital Product homepage showcase is two-column on desktop and stacks responsively', () => {
  assert.equal(existsSync(polishPath), true, 'homepage Digital Product polish stylesheet must exist')
  assert.match(layout, /import '\.\/marketing-mobile-product-polish\.css'/)
  assert.match(polish, /\.marketing-product-library__grid\s*\{[\s\S]*?grid-template-columns:/)
  assert.match(polish, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.marketing-product-library__grid\s*\{[^}]*grid-template-columns:\s*1fr/)
  assert.match(commerceCss, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.digital-product-card-swap/)
})

test('mobile marketing header pins actions and burger to the right-hand column', () => {
  assert.equal(existsSync(polishPath), true, 'mobile header polish stylesheet must exist')
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__actions\s*\{[^}]*grid-column:\s*2[^}]*justify-self:\s*end/)
})
