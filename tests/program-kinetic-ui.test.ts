import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const page = readFileSync(new URL('app/program/page.tsx', root), 'utf8')
const card = readFileSync(new URL('components/marketing/service-card.tsx', root), 'utf8')
const kinetic = readFileSync(new URL('components/marketing/program-kinetic.tsx', root), 'utf8')
const css = readFileSync(new URL('app/program/program-page.css', root), 'utf8')

test('program page uses kinetic bento hierarchy and journey rail', () => {
  assert.match(page, /ProgramKineticSurface/)
  assert.match(page, /01', title: 'Pilih kebutuhan/)
  assert.match(page, /02', title: 'Kenali format/)
  assert.match(page, /03', title: 'Mulai persiapan/)
  assert.match(page, /program-intro-facts/)
  assert.match(page, /data-program-band/)
})

test('service cards expose interactive spotlight hooks', () => {
  assert.match(card, /data-program-card/)
  assert.match(card, /marketing-service-card__spotlight/)
  assert.match(card, /marketing-service-card__action/)
})

test('kinetic pointer behavior is reduced-motion safe', () => {
  assert.match(kinetic, /prefers-reduced-motion: reduce/)
  assert.match(kinetic, /--program-card-x/)
  assert.match(kinetic, /--program-tilt-y/)
  assert.match(kinetic, /pointerType === 'touch'/)
})

test('program stylesheet creates full-width bento and motion-safe treatment', () => {
  assert.match(css, /marketing-services-secondary[\s\S]*?max-width:\s*none/)
  assert.match(css, /program-journey/)
  assert.match(css, /marketing-service-card__spotlight/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})
