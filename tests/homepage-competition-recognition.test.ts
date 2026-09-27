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
  assert.match(section, /data-testid="homepage-recognition-logo-section"/)
  assert.match(section, /data-testid="homepage-recognition-logo-wall"/)
  assert.match(section, /alt=\{hidden \? '' : recognition\.competition_name\}/)
  assert.match(section, /loading="lazy"/)
  assert.match(section, /width=\{COMPETITION_RECOGNITION_LOGO_WIDTH\}/)
  assert.match(section, /height=\{COMPETITION_RECOGNITION_LOGO_HEIGHT\}/)
})

test('recognition logos wait for twelve records before using two balanced rows', async () => {
  const section = await read('components/marketing/competition-recognition-section.tsx')

  assert.match(section, /recognitions\.length === 1/)
  assert.match(section, /MINIMUM_LOGOS_FOR_TWO_ROWS\s*=\s*12/)
  assert.match(section, /recognitions\.length >= MINIMUM_LOGOS_FOR_TWO_ROWS/)
  assert.match(section, /recognitions\.filter\(\(_recognition, index\) => index % 2 === 0\)/)
  assert.match(section, /recognitions\.filter\(\(_recognition, index\) => index % 2 === 1\)/)
  assert.match(section, /homepage-recognition__logo-wall--static/)
  assert.match(section, /homepage-recognition__logo-wall--animated/)
  assert.match(section, /homepage-recognition__reduced-grid/)
  assert.match(section, /homepage-recognition__logo-row--forward/)
  assert.match(section, /homepage-recognition__logo-row--reverse/)
})

test('animated recognition rows fill their cycles while exposing each source logo only once', async () => {
  const section = await read('components/marketing/competition-recognition-section.tsx')

  assert.match(section, /MINIMUM_LOGOS_PER_CYCLE\s*=\s*12/)
  assert.match(section, /hidden=\{isDuplicate \|\| repetition > 0\}/)
  assert.match(section, /aria-hidden=\{isDuplicate \|\| undefined\}/)
  assert.match(section, /alt=\{hidden \? '' : recognition\.competition_name\}/)
  assert.match(section, /draggable=\{false\}/)
  assert.match(section, /tabIndex=\{-1\}/)
  assert.doesNotMatch(section, /<button|<a\s|onPointer|onMouse|onTouch/)
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

test('recognition presentation separates a warm statement from the white logo motion band', async () => {
  const css = await read('app/marketing.css')
  const start = css.indexOf('.homepage-recognition')
  const scoped = start >= 0 ? css.slice(start) : ''

  assert.match(scoped, /\.homepage-recognition__statement\s*\{[^}]*background:\s*color-mix\([^;]*var\(--marketing-orange\)[^;]*var\(--marketing-yellow\)/)
  assert.match(scoped, /\.homepage-recognition__logos\s*\{[^}]*background:\s*#fff/)
  assert.match(scoped, /text-align:\s*center/)
  assert.match(scoped, /\.homepage-recognition__logos\s*\{[^}]*pointer-events:\s*none/)
  assert.match(scoped, /object-fit:\s*contain/)
  assert.match(scoped, /\.homepage-recognition h2\s*\{[^}]*max-width:\s*1180px/)
  assert.match(scoped, /\.homepage-recognition__logo\s*\{[^}]*width:\s*clamp\(112px,\s*10vw,\s*160px\)[^}]*aspect-ratio:\s*5\s*\/\s*2/)
  assert.match(scoped, /\.homepage-recognition__logo img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain/)
  assert.doesNotMatch(scoped.slice(0, scoped.indexOf('@media (max-width', 1)), /background:\s*(?:linear-gradient|radial-gradient)|box-shadow/)
  assert.doesNotMatch(scoped, /homepage-recognition[^\n]*:(hover|focus)|carousel/i)
})

test('recognition logo rows animate continuously in opposite straight directions', async () => {
  const css = await read('app/marketing.css')
  const start = css.indexOf('.homepage-recognition')
  const scoped = start >= 0 ? css.slice(start) : ''

  assert.match(scoped, /\.homepage-recognition__logo-track,[\s\S]*?width:\s*max-content/)
  assert.match(scoped, /\.homepage-recognition__logo-track\s*\{[^}]*will-change:\s*transform/)
  assert.match(scoped, /\.homepage-recognition__logo-row--forward[^{]*\.homepage-recognition__logo-track\s*\{[^}]*animation:\s*recognition-logo-forward[^}]*linear[^}]*infinite/)
  assert.match(scoped, /\.homepage-recognition__logo-row--reverse[^{]*\.homepage-recognition__logo-track\s*\{[^}]*animation:\s*recognition-logo-reverse[^}]*linear[^}]*infinite/)
  assert.match(scoped, /\.homepage-recognition__logo-row--forward[^{]*\.homepage-recognition__logo-track\s*\{[^}]*animation-delay:\s*-48s/)
  assert.match(scoped, /\.homepage-recognition__logo-row--reverse[^{]*\.homepage-recognition__logo-track\s*\{[^}]*animation-delay:\s*-52s/)
  assert.match(scoped, /@keyframes recognition-logo-forward\s*\{[^}]*translate3d\(-50%,\s*0,\s*0\)/)
  assert.match(scoped, /@keyframes recognition-logo-reverse\s*\{[^}]*translate3d\(-50%,\s*0,\s*0\)[\s\S]*translate3d\(0,\s*0,\s*0\)/)
})

test('reduced motion removes duplicate fillers and centers each real recognition once', async () => {
  const css = await read('app/marketing.css')
  const reducedMotion = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))

  assert.match(reducedMotion, /\.homepage-recognition__logo-row \.homepage-recognition__logo-track\s*\{[^}]*animation:\s*none[^}]*transform:\s*none/)
  assert.match(reducedMotion, /\.homepage-recognition__logo-cycle\[aria-hidden='true'\][^{]*\{\s*display:\s*none/)
  assert.match(reducedMotion, /\.homepage-recognition__logo\[aria-hidden='true'\][^{]*\{\s*display:\s*none/)
  assert.match(reducedMotion, /\.homepage-recognition__logo-wall--animated\s*\{\s*display:\s*none/)
  assert.match(reducedMotion, /\.homepage-recognition__reduced-grid\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/)
  assert.match(reducedMotion, /flex-wrap:\s*wrap/)
  assert.doesNotMatch(reducedMotion, /overflow-x:\s*auto|scroll-snap/)
})
