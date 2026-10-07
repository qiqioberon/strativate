import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const intro = readFileSync(new URL('../components/marketing/page-intro.tsx', import.meta.url), 'utf8')
const marketing = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const program = readFileSync(new URL('../app/program/page.tsx', import.meta.url), 'utf8')
const programStyles = readFileSync(new URL('../app/program/program-layout-fix.css', import.meta.url), 'utf8')
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
  assert.match(marketing, /\.homepage-hero \.marketing-hero__headline\s*\{[^}]*font-size:\s*clamp\(3\.1rem,\s*6\.1vw,\s*6\.2rem\)[^}]*line-height:\s*1\.02/)
  assert.match(marketing, /\.marketing-page-intro h1\s*\{[^}]*color:\s*#fff4e8[^}]*font-size:\s*clamp\(3\.1rem,\s*6\.1vw,\s*6\.2rem\)[^}]*font-weight:\s*760[^}]*line-height:\s*1\.02/)
  assert.match(marketing, /\.homepage-hero \.marketing-hero__lede\s*\{[^}]*margin-top:\s*clamp\(22px,\s*2\.4vw,\s*30px\)/)
  assert.match(marketing, /\.marketing-site h1, \.marketing-site h2, \.marketing-site h3, \.marketing-site p, \.marketing-site figure \{ margin: 0; \}/)
  assert.match(marketing, /\.marketing-page-intro \.marketing-page-intro__description\s*\{[^}]*margin-top:\s*clamp\(22px,\s*2\.4vw,\s*30px\)/)
  assert.match(marketing, /@media \(max-width: 760px\)[\s\S]*\.marketing-page-intro \.marketing-page-intro__description\s*\{[^}]*margin-top:\s*20px/)
  assert.doesNotMatch(marketing, /(?<!\.marketing-page-intro )\.marketing-page-intro__description\s*\{/)
  assert.doesNotMatch(programStyles, /marketing-page-intro/)
})

test('mentor directory tightens only its post-intro desktop spacing', () => {
  assert.match(mentor, /className="marketing-page-section mentor-directory-section"/)
  assert.match(marketing, /\.marketing-page-section \{ padding: clamp\(70px, 8vw, 120px\) 0; \}/)
  assert.match(marketing, /@media \(min-width: 761px\) \{\s*\.mentor-directory-section \{ padding-top: clamp\(48px, 4\.5vw, 68px\); \}\s*\}/)
  assert.doesNotMatch(intro, /mentor-directory-section/)
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

test('About Us keeps the story after PageIntro with the approved clean headline treatment', () => {
  assert.match(about, /<PageIntro[\s\S]*<section className="marketing-section about-reference-story"/)
  assert.match(about, /<h2>Empowering Future Business Leaders<\/h2>/)
  assert.doesNotMatch(about, /<em>|Editorial image slot/)
  assert.match(marketing, /\.about-reference-story h2/)
})
