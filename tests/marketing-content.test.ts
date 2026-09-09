import assert from 'node:assert/strict'
import test from 'node:test'

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
      { label: 'Beranda', href: '/' },
      { label: 'Program', href: '/program' },
      { label: 'Mentor', href: '/mentor' },
      { label: 'Produk Digital', href: '/produk-digital' },
      { label: 'Tentang Kami', href: '/tentang-kami' },
      { label: 'Tanya Jawab', href: '/tanya-jawab' },
    ],
  )
})

test('placeholder marketing content excludes unresolved production claims', async () => {
  let content: typeof import('../lib/content/marketing-content')
  try {
    content = await import('../lib/content/marketing-content')
  } catch (error) {
    assert.fail(`Marketing content is unavailable: ${String(error)}`)
  }

  const serialized = JSON.stringify({
    mentors: content.mentorPlaceholders,
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

  assert.equal(content.mentorPlaceholders.every(item => item.contentStatus === 'placeholder'), true)
  assert.equal(content.productPlaceholders.every(item => item.contentStatus === 'placeholder'), true)
})

test('asset registry keeps temporary media in the placeholder directory', async () => {
  let assets: typeof import('../lib/content/asset-registry')
  try {
    assets = await import('../lib/content/asset-registry')
  } catch (error) {
    assert.fail(`Asset registry is unavailable: ${String(error)}`)
  }

  const entries = assets.listAssets()
  assert.ok(entries.length >= 12)

  for (const asset of entries) {
    assert.match(asset.src, /^\/assets\/placeholders\//)
    assert.equal(asset.placeholder, true)
    assert.equal(asset.status, 'placeholder')
    assert.match(asset.priority, /^P[0-2]$/)
    assert.ok(asset.alt.length > 0)
    assert.ok(asset.notes.length > 0)
  }

  assert.equal(assets.getAsset('brand.logo.primary').alt, 'Placeholder logo utama Strativate')
  assert.equal(assets.getAsset('programs.bigClass.cover').priority, 'P1')
})
