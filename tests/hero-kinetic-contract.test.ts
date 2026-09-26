import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync(new URL('../components/marketing/home-page.tsx', import.meta.url), 'utf8')
const kinetic = readFileSync(new URL('../components/marketing/hero-kinetic.tsx', import.meta.url), 'utf8')
const shapeGrid = readFileSync(new URL('../components/marketing/hero-shape-grid.tsx', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const marketingCss = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')

test('homepage hero uses the approved centered success-story composition', () => {
  assert.match(home, /Win Business Competitions with Expert Mentoring/)
  assert.match(home, /Transform your ideas into winning strategies\./)
  assert.match(home, /HeroShapeGrid/)
  assert.match(home, /TestimonialCircularGallery/)
  assert.match(home, />Consultation <MessageCircle/)
  assert.doesNotMatch(home, /HeroCarousel|hero-program-link|Chat on WhatsApp|TextType|HeroKineticSurface|MagneticAction/)
})

test('homepage proof cloud uses isolated hand-drawn paper styling', () => {
  assert.match(marketingCss, /--homepage-cloud-paper: #fffaf2/)
  assert.match(marketingCss, /--homepage-cloud-sketch: rgba\(104, 72, 52, \.34\)/)
  assert.match(marketingCss, /\.homepage-hero-cloud__lobes span::after/)
  assert.match(marketingCss, /\.homepage-hero-cloud__lobes span:nth-child\(4\)[\s\S]*rotate\(\.35deg\)/)
  assert.match(marketingCss, /background-size: 13px 11px, 17px 15px/)
  assert.match(marketingCss, /bottom: -4px/)
})

test('homepage hero uses the React Bits Shape Grid canvas implementation', () => {
  assert.match(shapeGrid, /Adapted for Strativate from React Bits Shape Grid/)
  assert.match(shapeGrid, /getContext\('2d'\)/)
  assert.match(shapeGrid, /new IntersectionObserver/)
  assert.match(shapeGrid, /hoverTrailAmount/)
  assert.match(shapeGrid, /requestAnimationFrame\(updateAnimation\)/)
  assert.match(shapeGrid, /prefers-reduced-motion: reduce/)
  assert.match(shapeGrid, /data-react-bits="shape-grid"/)
  assert.doesNotMatch(shapeGrid, /Array\.from\(\{ length: 35 \}/)
  assert.doesNotMatch(shapeGrid, /homepage-shape-grid__shape/)
})

test('kinetic hero styles are isolated, pointer-reactive, and motion safe', () => {
  const cssPath = new URL('../app/hero-kinetic.css', import.meta.url)
  assert.equal(existsSync(cssPath), true)
  const css = readFileSync(cssPath, 'utf8')
  assert.match(css, /--hero-spot-x/)
  assert.match(css, /marketing-hero-stage__node/)
  assert.match(css, /perspective\(/)
  assert.match(css, /marketing-hero__magnetic/)
  assert.match(css, /prefers-reduced-motion/)
  assert.ok(layout.indexOf("./hero-kinetic.css") > layout.indexOf("./marketing.css"))
})

test('accent headline reveal never clips glyph bounds', () => {
  const css = readFileSync(new URL('../app/hero-kinetic.css', import.meta.url), 'utf8')
  const keyframes = css.match(/@keyframes hero-accent-reveal\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.doesNotMatch(keyframes, /clip-path:/)
})
