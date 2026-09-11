import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('the handoff exposes the approved brand, contact, and proof facts', async () => {
  let brand: typeof import('../lib/content/brand')
  try {
    brand = await import('../lib/content/brand')
  } catch (error) {
    assert.fail(`Brand content is unavailable: ${String(error)}`)
  }

  assert.deepEqual(brand.brandPalette, {
    orange: '#FF7A00',
    red: '#DC0D16',
    deepRed: '#B3151C',
    yellow: '#FFE79D',
    black: '#000000',
    white: '#FDFDFD',
  })
  assert.equal(brand.publicContact.phone, '+62 851-8775-4671')
  assert.equal(brand.publicContact.whatsapp, 'https://wa.me/6285187754671')
  assert.equal(brand.publicContact.email, 'strativateid@gmail.com')
  assert.deepEqual(brand.socialProof.map(item => item.value), ['2500+', '15+', '20+'])
  assert.equal(brand.socialProof[0].label, 'Siswa didukung')
})

test('the mentor directory represents all 26 rows without leaking internal fields', async () => {
  let content: typeof import('../lib/content/mentors')
  try {
    content = await import('../lib/content/mentors')
  } catch (error) {
    assert.fail(`Mentor content is unavailable: ${String(error)}`)
  }

  assert.equal(content.mentors.length, 26)
  assert.equal(new Set(content.mentors.map(mentor => mentor.slug)).size, 26)
  assert.equal(content.mentors.filter(mentor => mentor.photoStatus === 'ready').length, 19)
  assert.deepEqual(
    content.mentors.filter(mentor => mentor.photoStatus === 'missing').map(mentor => mentor.name),
    ['Ivonne Qiu', 'Fajri Alan', 'Deanna', 'Terry Kuron', 'Albert Lukas', 'Faluna A. Janitra', 'M. Sultan Perkasa'],
  )

  const serialized = JSON.stringify(content.mentors).toLowerCase()
  for (const privateField of ['internalnotes', 'sourcerow', 'rating', 'top tier, dan', 'top tier, tp']) {
    assert.equal(serialized.includes(privateField), false, `must exclude ${privateField}`)
  }
})

test('every ready registry asset exists at its declared public path', async () => {
  const { listAssets } = await import('../lib/content/asset-registry')
  for (const asset of listAssets().filter(asset => asset.status === 'ready')) {
    assert.equal(existsSync(join(process.cwd(), 'public', asset.src)), true, `missing ${asset.src}`)
  }
  for (const icon of ['app/icon.png', 'app/apple-icon.png', 'app/opengraph-image.png']) {
    assert.equal(existsSync(join(process.cwd(), icon)), true, `missing ${icon}`)
  }
})

test('the program overview contains exactly eight sourced services and only verified detail routes', async () => {
  let content: typeof import('../lib/content/services')
  try {
    content = await import('../lib/content/services')
  } catch (error) {
    assert.fail(`Service content is unavailable: ${String(error)}`)
  }

  assert.deepEqual(content.services.map(service => service.name), [
    'Private Mentoring',
    'Intensive Mentoring',
    'Big Class',
    'Consultation',
    'Mock Competition',
    'Proposal Review and Feedback',
    'Workshop',
    'Community',
  ])
  assert.deepEqual(content.services.filter(service => service.productType).map(service => service.productType), ['private_mentoring', 'intensive_mentoring'])
  assert.equal(content.connectServicesToCatalog([]).some(service => service.href), false)
  const publishedPrivate = {
    id: 'private-id', code: 'private_mentoring', slug: 'private-custom', productType: 'private_mentoring' as const,
    defaultPurchaseFlow: 'consultation_offer' as const, title: 'Mentoring Privat', shortDescription: 'Published', description: null,
    isFeatured: true, sortOrder: 1, startingPriceAmount: 300000, hasQuotationPricing: false,
  }
  const connected = content.connectServicesToCatalog([publishedPrivate])
  assert.equal(connected[0].href, '/program/private-custom')
  assert.equal(connected[0].detailLabel, 'Lihat Mentoring Privat')
  assert.equal(connected[1].href, undefined)
})
