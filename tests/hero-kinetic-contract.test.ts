import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync(new URL('../components/marketing/home-page.tsx', import.meta.url), 'utf8')
const kinetic = readFileSync(new URL('../components/marketing/hero-kinetic.tsx', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')

test('homepage hero uses the approved static stakeholder composition', () => {
  assert.match(home, /Win Business Competitions with Expert Mentoring/)
  assert.match(home, /Transform your ideas into winning strategies\./)
  assert.match(home, /HeroCarousel/)
  assert.doesNotMatch(home, /TextType|HeroKineticSurface|MagneticAction/)
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
