import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const intro = readFileSync(new URL('../components/marketing/page-intro.tsx', import.meta.url), 'utf8')
const marketing = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const program = readFileSync(new URL('../app/program/page.tsx', import.meta.url), 'utf8')
const mentor = readFileSync(new URL('../app/mentor/page.tsx', import.meta.url), 'utf8')
const products = readFileSync(new URL('../app/produk-digital/page.tsx', import.meta.url), 'utf8')
const publications = readFileSync(new URL('../app/publications/page.tsx', import.meta.url), 'utf8')
const competitions = readFileSync(new URL('../app/competitions/page.tsx', import.meta.url), 'utf8')
const about = readFileSync(new URL('../app/tentang-kami/page.tsx', import.meta.url), 'utf8')
const faq = readFileSync(new URL('../app/tanya-jawab/page.tsx', import.meta.url), 'utf8')

test('shared PageIntro renders the hero hierarchy as one centered content column', () => {
  assert.match(intro, /marketing-page-eyebrow[\s\S]*marketing-page-title[\s\S]*marketing-page-intro__aside/)
  assert.match(marketing, /\.marketing-page-intro__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
  assert.match(marketing, /\.marketing-page-intro__aside\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
  assert.match(program, /<PageIntro/)
  assert.match(mentor, /<PageIntro/)
  assert.match(products, /<PageIntro/)
})

test('editorial and FAQ landing heroes center their existing primary copy', () => {
  assert.match(publications, /editorial-hero editorial-hero--publications/)
  assert.match(competitions, /editorial-hero editorial-hero--competition/)
  assert.match(faq, /faq-reference-hero/)
  assert.match(marketing, /\.editorial-hero \.marketing-container\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
  assert.match(marketing, /\.faq-reference-hero \.marketing-container\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
})

test('About Us hero is a centered single column with its visual below the copy', () => {
  assert.match(about, /about-reference-hero__grid[\s\S]*about-reference-visual/)
  assert.match(marketing, /\.about-reference-hero__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
  assert.match(marketing, /\.about-reference-visual\s*\{[^}]*width:\s*min\(100%,\s*880px\)/)
})
