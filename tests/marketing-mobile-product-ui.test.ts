import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const carousel = readFileSync('components/marketing/digital-product-carousel.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const polishPath = 'app/marketing-mobile-product-polish.css'
const polish = existsSync(polishPath) ? readFileSync(polishPath, 'utf8') : ''

test('Digital Product homepage carousel auto-advances every five seconds and links each slide to detail', () => {
  assert.match(carousel, /const AUTOPLAY_MS = 5000/)
  assert.match(carousel, /href=\{`\/produk-digital\/\$\{product\.slug\}`\}/)
  assert.match(carousel, /data-testid=\{`digital-product-detail-link-\$\{product\.slug\}`\}/)
})

test('Digital Product homepage carousel uses a centered portrait hero-like frame', () => {
  assert.equal(existsSync(polishPath), true, 'portrait polish stylesheet must exist')
  assert.match(layout, /import '\.\/marketing-mobile-product-polish\.css'/)
  assert.match(polish, /\.digital-product-carousel\s*\{[^}]*width:\s*min\(100%,\s*520px\)[^}]*margin-inline:\s*auto/)
  assert.match(polish, /\.digital-product-carousel__viewport\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*5[^}]*min-height:\s*0/)
})

test('mobile marketing header pins actions and burger to the right-hand column', () => {
  assert.equal(existsSync(polishPath), true, 'mobile header polish stylesheet must exist')
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(polish, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.marketing-header__actions\s*\{[^}]*grid-column:\s*2[^}]*justify-self:\s*end/)
})
