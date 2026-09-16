import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const carousel = readFileSync('components/marketing/digital-product-carousel.tsx', 'utf8')
const home = readFileSync('components/marketing/home-page.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const polishPath = 'app/marketing-mobile-product-polish.css'
const polish = existsSync(polishPath) ? readFileSync(polishPath, 'utf8') : ''

test('Digital Product homepage carousel auto-advances every five seconds and links each slide to detail', () => {
  assert.match(carousel, /const AUTOPLAY_MS = 5000/)
  assert.match(carousel, /href=\{`\/produk-digital\/\$\{product\.slug\}`\}/)
  assert.match(carousel, /data-testid=\{`digital-product-detail-link-\$\{product\.slug\}`\}/)
})

test('Digital Product homepage section pairs editorial copy with a storefront CTA and carousel', () => {
  assert.match(home, /marketing-product-library__grid/)
  assert.match(home, /marketing-product-library__copy/)
  assert.match(home, /id="digital-products-heading"/)
  assert.match(home, /href="\/produk-digital"/)
  assert.match(home, /data-testid="homepage-products-cta"/)
})

test('Digital Product carousel keeps arrows and pagination inside the viewport overlay', () => {
  const viewportStart = carousel.indexOf('className="digital-product-carousel__viewport"')
  const controls = carousel.indexOf('className="digital-product-carousel__controls"')
  const carouselClose = carousel.lastIndexOf('</div>')

  assert.notEqual(viewportStart, -1)
  assert.notEqual(controls, -1)
  assert.ok(controls > viewportStart && controls < carouselClose)
  assert.match(carousel, /digital-product-carousel__arrow--previous/)
  assert.match(carousel, /digital-product-carousel__arrow--next/)
  assert.match(polish, /\.digital-product-carousel__controls\s*\{[\s\S]*?position:\s*absolute[\s\S]*?margin-top:\s*0/)
  assert.match(polish, /\.digital-product-carousel__dots\s*\{[\s\S]*?bottom:\s*16px[\s\S]*?left:\s*50%/)
})

test('Digital Product homepage showcase is two-column on desktop and stacks responsively', () => {
  assert.equal(existsSync(polishPath), true, 'homepage Digital Product polish stylesheet must exist')
  assert.match(layout, /import '\.\/marketing-mobile-product-polish\.css'/)
  assert.match(polish, /\.marketing-product-library__grid\s*\{[\s\S]*?grid-template-columns:/)
  assert.match(polish, /\.digital-product-carousel\s*\{[\s\S]*?width:\s*min\(100%,\s*620px\)[\s\S]*?margin-inline:\s*auto/)
  assert.match(polish, /\.digital-product-carousel__viewport\s*\{[\s\S]*?aspect-ratio:\s*5\s*\/\s*6[\s\S]*?min-height:\s*0/)
  assert.match(polish, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.marketing-product-library__grid\s*\{[^}]*grid-template-columns:\s*1fr/)
  assert.match(polish, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.digital-product-carousel__viewport\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*5/)
})

test('mobile marketing header pins actions and burger to the right-hand column', () => {
  assert.equal(existsSync(polishPath), true, 'mobile header polish stylesheet must exist')
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__actions\s*\{[^}]*grid-column:\s*2[^}]*justify-self:\s*end/)
})
