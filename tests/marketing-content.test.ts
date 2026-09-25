import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function readProjectFile(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

test('shared typography loads Poppins once and exposes it through every CSS font token', async () => {
  const [layout, globals, marketing] = await Promise.all([
    readProjectFile('app/layout.tsx'),
    readProjectFile('app/globals.css'),
    readProjectFile('app/marketing.css'),
  ])
  const sharedSources = `${layout}\n${globals}\n${marketing}`

  assert.match(layout, /import\s*{\s*Poppins\s*}\s*from\s*['\"]next\/font\/google['\"]/)
  assert.match(layout, /Poppins\([^)]*variable:\s*['\"]--font-poppins['\"][^)]*\)/)
  assert.match(globals, /--font-sans:\s*var\(--font-poppins\),\s*sans-serif/)
  assert.match(globals, /--font-heading:\s*var\(--font-poppins\),\s*sans-serif/)
  assert.match(globals, /--font-mono:\s*var\(--font-poppins\),\s*sans-serif/)

  for (const retiredFont of ['DM_Sans', 'Outfit', 'IBM_Plex_Mono', '--font-dm-sans', '--font-outfit', '--font-ibm-plex']) {
    assert.equal(sharedSources.includes(retiredFont), false, `${retiredFont} must not remain in shared typography`)
  }
})

test('PageIntro provides an inaccessible decorative motif hook', async () => {
  const pageIntro = await readProjectFile('components/marketing/page-intro.tsx')

  assert.match(pageIntro, /motif\??:\s*['\"]program['\"]\s*\|\s*['\"]mentor['\"]\s*\|\s*['\"]about['\"]\s*\|\s*['\"]faq['\"]/)
  assert.match(pageIntro, /data-testid=['\"]marketing-page-intro-motif['\"]/)
  assert.match(pageIntro, /aria-hidden=['\"]true['\"]/)
})

test('marketing navigation exposes the approved dedicated routes', async () => {
  let content: typeof import('../lib/content/marketing-content')
  try {
    content = await import('../lib/content/marketing-content')
  } catch (error) {
    assert.fail(`Marketing content is unavailable: ${String(error)}`)
  }

  assert.deepEqual(
    content.marketingNavigation.map(({ label, href }) => ({ label, href })),
    [
      { label: 'Home', href: '/' },
      { label: 'Programs', href: '/program' },
      { label: 'Mentors', href: '/mentor' },
      { label: 'Publications', href: '/publications' },
      { label: 'Competitions', href: '/competitions' },
      { label: 'About Us', href: '/tentang-kami' },
      { label: 'FAQ', href: '/tanya-jawab' },
    ],
  )
  assert.equal(content.marketingNavigation.some(item => item.href === '/produk-digital'), false)
})

test('placeholder marketing content excludes unresolved production claims', async () => {
  let content: typeof import('../lib/content/marketing-content')
  try {
    content = await import('../lib/content/marketing-content')
  } catch (error) {
    assert.fail(`Marketing content is unavailable: ${String(error)}`)
  }

  const serialized = JSON.stringify({
    products: content.productPlaceholders,
    proof: content.preparationPrinciples,
  })

  for (const unresolved of [
    'Alvin Haryanto',
    'Nadia Prameswari',
    'Raka Adhitama',
    '2.500+',
    'Universitas mitra',
    '15+ kemenangan',
    'di 4 negara',
    '4,9',
    'Rp59.000',
    'Rp79.000',
    'Rp89.000',
    'Rp99.000',
  ]) {
    assert.equal(serialized.includes(unresolved), false, `must exclude ${unresolved}`)
  }

  assert.equal(content.productPlaceholders.every(item => item.contentStatus === 'placeholder'), true)
})

test('FAQ directory has source-backed Programs, Mentors, Account, and Support answers only', async () => {
  const content = await import('../lib/content/marketing-content')
  const allowedCategories = new Set(['Programs', 'Mentors', 'Account', 'Support'])

  assert.ok(content.faqPreview.length >= 8 && content.faqPreview.length <= 12)
  assert.equal(new Set(content.faqPreview.map(item => item.question)).size, content.faqPreview.length)

  for (const item of content.faqPreview) {
    assert.ok(allowedCategories.has(item.category), `${item.category} is not an approved FAQ category`)
    assert.match(item.answer, /\S/)
    assert.match(item.source, /^(services|mentor-directory|auth|public-contact)$/)
  }

  const serialized = JSON.stringify(content.faqPreview)
  for (const unresolved of ['Rp450.000', 'Laboratorium Kepemimpinan', 'Landasan Karier', 'jaminan kemenangan', 'refund', 'mitra']) {
    assert.equal(serialized.toLocaleLowerCase('id').includes(unresolved.toLocaleLowerCase('id')), false, `FAQ must not publish unresolved ${unresolved}`)
  }
})

test('FAQ contact answer reuses the approved public contact record', async () => {
  const [brand, content, contentSource] = await Promise.all([
    import('../lib/content/brand'),
    import('../lib/content/marketing-content'),
    readProjectFile('lib/content/marketing-content.ts'),
  ])
  const contactAnswer = content.faqPreview.find(item => item.question === 'How can I contact Strativate?')

  assert.ok(contactAnswer)
  assert.equal(contactAnswer.answer, `Contact Strativate through WhatsApp at ${brand.publicContact.phone} or email ${brand.publicContact.email}.`)
  assert.equal(contentSource.includes('+62 851-8775-4671'), false)
  assert.equal(contentSource.includes('strativateid@gmail.com'), false)
  assert.match(contentSource, /import\s*{\s*publicContact\s*}\s*from\s*['"]\.\/brand['"]/)
  assert.match(contentSource, /publicContact\.phone/)
  assert.match(contentSource, /publicContact\.email/)
})

test('homepage intentionally limits the expanded FAQ directory to three previews', async () => {
  const homePage = await readProjectFile('components/marketing/home-page.tsx')

  assert.match(homePage, /faqPreview\.slice\(0,\s*3\)\.map/)
})

test('asset registry separates supplied production assets from explicit fallbacks', async () => {
  let assets: typeof import('../lib/content/asset-registry')
  try {
    assets = await import('../lib/content/asset-registry')
  } catch (error) {
    assert.fail(`Asset registry is unavailable: ${String(error)}`)
  }

  const entries = assets.listAssets()
  assert.ok(entries.length >= 37)

  for (const asset of entries.filter(asset => asset.status === 'placeholder')) {
    assert.match(asset.src, /^\/assets\/placeholders\//)
    assert.equal(asset.placeholder, true)
    assert.equal(asset.status, 'placeholder')
    assert.match(asset.priority, /^P[0-2]$/)
    assert.ok(asset.alt.length > 0)
    assert.ok(asset.notes.length > 0)
  }

  assert.equal(assets.getAsset('brand.logo.primary').status, 'ready')
  assert.equal(assets.getAsset('brand.logo.primary').src, '/assets/brand/strativate-wordmark.png')
  assert.equal(entries.filter(asset => asset.status === 'ready' && asset.src.startsWith('/assets/mentors/')).length, 19)
  assert.equal(entries.filter(asset => asset.status === 'missing').length, 7)
  assert.equal(assets.getAsset('programs.bigClass.cover').priority, 'P1')
})
