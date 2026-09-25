import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('public navigation includes the approved English destinations', async () => {
  const source = await read('lib/content/marketing-content.ts')

  for (const label of ['Home', 'Programs', 'Mentors', 'Publications', 'Competitions', 'FAQ']) {
    assert.match(source, new RegExp(`label: ['"]${label}['"]`))
  }
  assert.match(source, /href: ['"]\/publications['"]/)
  assert.match(source, /href: ['"]\/competitions['"]/)
})

test('homepage uses the stakeholder copy and new proof-led order without typing animation', async () => {
  const source = await read('components/marketing/home-page.tsx')

  assert.match(source, /Win Business Competitions with Expert Mentoring/)
  assert.match(source, /Where Future-Ready Skills Meet Competition Success/)
  assert.match(source, /What We Specialize In/)
  assert.match(source, /TestimonialCircularGallery/)
  assert.doesNotMatch(source, /Partnered with Leading Organizations/)
  assert.doesNotMatch(source, /TextType|hero-text-type/)

  const sections = [
    'homepage-success-proof-section',
    'homepage-who-we-are-section',
    'homepage-programs-section',
    'homepage-products-section',
    'homepage-expertise-section',
    'homepage-mentors-section',
    'homepage-why-choose-section',
  ]
  const positions = sections.map(section => source.indexOf(section))
  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
})

test('publications and competitions have public routes and admin sections', async () => {
  const [admin, publications, competitions] = await Promise.all([
    read('app/admin/page.tsx'),
    read('app/publications/page.tsx'),
    read('app/competitions/page.tsx'),
  ])

  assert.match(admin, /Publications/)
  assert.match(admin, /Competitions/)
  assert.match(publications, /MarketingShell/)
  assert.match(competitions, /MarketingShell/)
})
