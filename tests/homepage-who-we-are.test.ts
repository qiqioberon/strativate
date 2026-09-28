import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('homepage loads fixed Who We Are media without converting the page or section to a client component', async () => {
  const [page, home, section, query] = await Promise.all([
    read('app/page.tsx'),
    read('components/marketing/home-page.tsx'),
    read('components/marketing/who-we-are-section.tsx'),
    read('lib/marketing/who-we-are-photos.ts'),
  ])

  assert.match(page, /listHomepageWhoWeArePhotos\(\)/)
  assert.match(page, /Promise\.all\(\[[\s\S]*listHomepageWhoWeArePhotos\(\)/)
  assert.match(page, /whoWeArePhotos=\{whoWeArePhotos\}/)
  assert.doesNotMatch(page, /['"]use client['"]/)
  assert.match(home, /<WhoWeAreSection photos=\{whoWeArePhotos\}/)
  assert.doesNotMatch(home, /['"]use client['"]/)
  assert.doesNotMatch(section, /['"]use client['"]/)

  assert.match(query, /import 'server-only'/)
  assert.match(query, /\.from\('homepage_who_we_are_photos'\)/)
  assert.match(query, /storage\.from\(WHO_WE_ARE_PHOTO_BUCKET\)\.getPublicUrl\(photo\.image_path\)/)
  assert.match(query, /WHO_WE_ARE_PHOTO_ROLES\.map/)
  assert.match(query, /if \(error\)[\s\S]*return \[\]/)
})

test('Who We Are section preserves approved source copy, CTA, and optional badge behavior', async () => {
  const [section, photo] = await Promise.all([
    read('components/marketing/who-we-are-section.tsx'),
    read('components/marketing/who-we-are-photo.tsx'),
  ])

  assert.match(section, />WHO WE ARE</)
  assert.match(section, /Where Future-Ready Skills Meet Competition Success/)
  assert.match(section, /Strativate is a mentorship and coaching platform that helps students build future-ready skills and excel in business and other competitions\. We’ve supported 2,500\+ students across 15\+ universities and 20\+ high schools, with our community earning top honors in prestigious competitions\./)
  assert.match(section, /href="\/tentang-kami"/)
  assert.match(section, />Learn More About Us</)
  assert.match(photo, /photo\.badge_text \? <figcaption/)
  assert.doesNotMatch(section, /Arrow|icon/i)
  assert.doesNotMatch(section, /doodle|spiral|squiggle|sticker/i)
})

test('collage isolates image failure handling and supports all partial states', async () => {
  const [section, collage, image] = await Promise.all([
    read('components/marketing/who-we-are-section.tsx'),
    read('components/marketing/who-we-are-collage.tsx'),
    read('components/marketing/who-we-are-photo.tsx'),
  ])

  assert.match(section, /photos\.length \? <WhoWeAreCollage photos=\{photos\}/)
  assert.match(collage, /data-count=\{photos\.length\}/)
  assert.match(collage, /photos\.map/)
  assert.match(image, /['"]use client['"]/)
  assert.match(image, /onError=\{\(\) => setFailed\(true\)\}/)
  assert.match(image, /if \(failed\) return null/)
  assert.match(image, /alt=\{photo\.alt_text\}/)
  assert.match(image, /width=\{target\.width\}/)
  assert.match(image, /height=\{target\.height\}/)
  assert.match(await read('app/marketing.css'), /\.homepage-who__collage:has\(> \.homepage-who__frame:nth-child\(2\):last-child\)/)
})

test('Who We Are styles keep a restrained editorial collage and mobile hierarchy', async () => {
  const css = await read('app/marketing.css')
  const start = css.indexOf('.homepage-who')
  const scoped = start >= 0 ? css.slice(start) : ''

  assert.match(scoped, /\.homepage-who__layout\s*\{[^}]*display:\s*grid/)
  assert.match(scoped, /\.homepage-who__primary\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/)
  assert.match(scoped, /\.homepage-who__upper_right\s*\{[^}]*aspect-ratio:\s*1/)
  assert.match(scoped, /\.homepage-who__lower_right\s*\{[^}]*aspect-ratio:\s*1/)
  assert.match(scoped, /\.homepage-who__collage\s*\{[^}]*width:\s*min\(100%,\s*650px\)[^}]*aspect-ratio:\s*1\s*\/\s*1/)
  assert.match(scoped, /\.homepage-who__primary\s*\{[^}]*width:\s*48%[^}]*rotate\(-1deg\)/)
  assert.match(scoped, /\.homepage-who__upper_right\s*\{[^}]*width:\s*47\.5%[^}]*rotate\(1\.5deg\)/)
  assert.match(scoped, /\.homepage-who__lower_right\s*\{[^}]*width:\s*47\.5%[^}]*rotate\(2deg\)/)
  assert.match(scoped, /\.homepage-who__frame\s*\{[^}]*background:\s*#fff[^}]*box-shadow:/)
  assert.match(scoped, /\.homepage-who__frame figcaption\s*\{[^}]*left:\s*12px[^}]*bottom:\s*12px[^}]*color:\s*#fff[^}]*background:\s*var\(--marketing-orange\)/)
  assert.match(scoped, /\.homepage-who__collage:has\(> \.homepage-who__frame:only-child\)/)
  assert.match(scoped, /\.homepage-who__copy > \.marketing-kicker\s*\{[^}]*font-size:\s*clamp\(\.76rem,\s*\.82vw,\s*\.88rem\)/)
  assert.match(scoped, /\.homepage-who__lede\s*\{[^}]*margin-top:\s*36px[^}]*font-size:\s*clamp\(1rem,\s*1\.12vw,\s*1\.1rem\)/)
  assert.match(scoped, /\.homepage-who__cta\s*\{[^}]*min-height:\s*50px[^}]*padding:\s*0\s*27px[^}]*border-radius:\s*999px[^}]*color:\s*#fff[^}]*background:\s*var\(--marketing-orange\)/)
  assert.match(scoped, /@media \(max-width:\s*520px\)[\s\S]*\.homepage-who__copy h2\s*\{[^}]*font-size:\s*clamp\(1\.75rem,\s*7\.2vw,\s*2rem\)/)
  assert.match(scoped, /@media \(max-width:\s*900px\)[\s\S]*\.homepage-who__layout\s*\{[^}]*grid-template-columns:\s*1fr/)
  assert.match(scoped, /@media \(max-width:\s*520px\)[\s\S]*\.homepage-who__collage(?:\s*,[^{]+)?\s*\{[^}]*grid-template-columns:\s*1fr/)
  const collageStyles = scoped.slice(0, scoped.indexOf('.stakeholder-method'))
  assert.doesNotMatch(collageStyles, /animation:/)
})
