import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('homepage loads competition recognition data and places the section directly after the hero', async () => {
  const [page, home] = await Promise.all([
    read('app/page.tsx'),
    read('components/marketing/home-page.tsx'),
  ])

  assert.match(page, /listActiveCompetitionRecognitions\(\)/)
  assert.match(page, /Promise\.all\(\[[\s\S]*listActiveCompetitionRecognitions\(\)/)
  assert.match(page, /<HomePage[\s\S]*recognitions=\{recognitions\}/)

  const heroEnd = home.indexOf('</section>', home.indexOf('homepage-hero-section'))
  const recognition = home.indexOf('<CompetitionRecognitionSection')
  const whoWeAre = home.indexOf('homepage-who-we-are-section')
  assert.ok(heroEnd >= 0 && heroEnd < recognition && recognition < whoWeAre)
})

test('recognition section preserves exact copy, accessible names, and its empty state', async () => {
  const section = await read('components/marketing/competition-recognition-section.tsx')

  assert.match(section, /Our mentors and students are award-winning business competition finalists\./)
  assert.match(section, /data-testid="homepage-recognition-section"/)
  assert.match(section, /recognitions\.length > 0/)
  assert.match(section, /data-testid="homepage-recognition-logo-wall"/)
  assert.match(section, /alt=\{recognition\.competition_name\}/)
  assert.match(section, /loading="lazy"/)
})

test('public recognition query returns active records in deterministic order with editorial URLs', async () => {
  const query = await read('lib/marketing/competition-recognitions.ts')

  assert.match(query, /import 'server-only'/)
  assert.match(query, /\.from\('competition_recognitions'\)/)
  assert.match(query, /\.eq\('is_active', true\)/)
  assert.match(query, /\.order\('display_order'\)[\s\S]*\.order\('created_at'\)[\s\S]*\.order\('id'\)/)
  assert.match(query, /storage\.from\('marketing-editorial'\)\.getPublicUrl\(recognition\.logo_path\)/)
  assert.match(query, /if \(error\)[\s\S]*return \[\]/)
  assert.match(query, /console\.warn\([^\n]*\{ code: error\.code \}\)/)
})

test('recognition presentation uses a calm solid background and contained wrapping logos', async () => {
  const css = await read('app/marketing.css')
  const start = css.indexOf('.homepage-recognition')
  const end = css.indexOf('@media', start)
  const scoped = start >= 0 ? css.slice(start, end) : ''

  assert.match(scoped, /background:\s*#[0-9a-f]{6}/i)
  assert.match(scoped, /text-align:\s*center/)
  assert.match(scoped, /display:\s*flex/)
  assert.match(scoped, /flex-wrap:\s*wrap/)
  assert.match(scoped, /object-fit:\s*contain/)
  assert.doesNotMatch(scoped, /linear-gradient|radial-gradient|box-shadow/)
  assert.doesNotMatch(scoped, /homepage-recognition[^\n]*:(hover|focus)|marquee|carousel/i)
})
