import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const intro = readFileSync(new URL('../components/marketing/page-intro.tsx', import.meta.url), 'utf8')
const marketing = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const program = readFileSync(new URL('../app/program/page.tsx', import.meta.url), 'utf8')
const programStyles = readFileSync(new URL('../app/program/program-page.css', import.meta.url), 'utf8')
const mentor = readFileSync(new URL('../app/mentor/page.tsx', import.meta.url), 'utf8')
const products = readFileSync(new URL('../app/produk-digital/page.tsx', import.meta.url), 'utf8')
const publications = readFileSync(new URL('../app/publications/page.tsx', import.meta.url), 'utf8')
const competitions = readFileSync(new URL('../app/competitions/page.tsx', import.meta.url), 'utf8')
const about = readFileSync(new URL('../app/tentang-kami/page.tsx', import.meta.url), 'utf8')
const faq = readFileSync(new URL('../app/tanya-jawab/page.tsx', import.meta.url), 'utf8')

test('shared PageIntro mirrors the homepage hero surface and centered hierarchy', () => {
  assert.match(intro, /HeroShapeGrid/)
  assert.match(intro, /marketing-page-title[\s\S]*marketing-page-description/)
  assert.doesNotMatch(intro, /marketing-page-intro-motif/)
  assert.match(marketing, /linear-gradient\(154deg, #e84a00 0%, #f65f05 23%, #ff7a00 47%, #ff9833 71%, #ffc27f 100%\)/)
  assert.match(marketing, /\.marketing-page-intro__grid\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/)
  assert.match(marketing, /\.marketing-page-intro h1\s*\{[^}]*color:\s*#fff4e8[^}]*font-size:\s*clamp\(2\.7rem,\s*4\.8vw,\s*5rem\)[^}]*font-weight:\s*760/)
  assert.match(marketing, /\.marketing-page-intro__description\s*\{[^}]*margin-top:\s*clamp\(56px,\s*5vw,\s*72px\)/)
  assert.doesNotMatch(programStyles, /\.program-page \.marketing-page-intro\s*\{/)
})

test('requested landing pages use the shared first section with revised headline copy', () => {
  for (const source of [program, mentor, products, publications, competitions, about, faq]) assert.match(source, /<PageIntro/)

  assert.match(program, /title="Our Programs"/)
  assert.doesNotMatch(program, /Build skills for/)
  assert.match(mentor, /title="Meet Our Mentors"/)
  assert.doesNotMatch(mentor, /Strativate Mentors|Mentors\./)
  assert.match(products, /title="Digital Products"/)
  assert.doesNotMatch(products, /Keep learning/)
  assert.match(publications, /title="Publications & News"/)
  assert.doesNotMatch(publications, /Insights & Updates/)
  assert.match(competitions, /title="Discover Top Competitions"/)
  assert.doesNotMatch(competitions, /Competition Directory/)
  assert.match(about, /title="About Us"/)
  assert.match(faq, /title="FAQ"/)
  assert.doesNotMatch(faq, /Have Questions\?|We Have Answers/)
})

test('About Us moves the former hero story into its own following section', () => {
  assert.match(about, /<PageIntro[\s\S]*<section className="marketing-section about-reference-story"/)
  assert.match(about, /<h2>Empowering Future<br \/><em>Business Leaders<\/em><\/h2>/)
  assert.doesNotMatch(about, /Business Leaders\./)
  assert.match(marketing, /\.about-reference-story h2/)
})
