import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDigitalProductImagePath,
  buildDigitalProductPayload,
  digitalProductMutationError,
  formatDigitalProductPrice,
  isDigitalProductSetupRequired,
  normalizeDigitalProductSlug,
  parseDigitalProductPriceInput,
  safeDigitalProductFileName,
  validateDigitalProductDraft,
} from '../lib/digital-products/admin'

test('slug generation produces strict lowercase URL-safe slugs without changing explicit values later', () => {
  assert.equal(normalizeDigitalProductSlug('  Business Case Handbook 2026!  '), 'business-case-handbook-2026')
  assert.equal(normalizeDigitalProductSlug('Crème Brûlée'), 'creme-brulee')
  assert.equal(normalizeDigitalProductSlug('---'), '')
})

test('price parsing accepts only non-negative safe integer Rupiah and formatting stays UI-only', () => {
  assert.equal(parseDigitalProductPriceInput('75000'), 75000)
  assert.equal(parseDigitalProductPriceInput('0'), 0)
  assert.equal(parseDigitalProductPriceInput('9007199254740991'), Number.MAX_SAFE_INTEGER)
  assert.equal(parseDigitalProductPriceInput(''), null)
  assert.equal(parseDigitalProductPriceInput('-1'), null)
  assert.equal(parseDigitalProductPriceInput('75.000'), null)
  assert.equal(parseDigitalProductPriceInput('75000.50'), null)
  assert.equal(parseDigitalProductPriceInput('9007199254740992'), null)
  assert.equal(formatDigitalProductPrice(75000), 'Rp75.000')
})

test('draft validation rejects malformed business fields and invalid covers while allowing edits without replacement', () => {
  const invalid = validateDigitalProductDraft({
    name: ' ',
    slug: 'Business Case Handbook',
    description: '',
    priceInput: '-1',
    file: { type: 'image/gif', size: 100 },
    hasStoredImage: false,
  })
  assert.equal(invalid.name, 'Nama produk wajib diisi.')
  assert.equal(invalid.slug, 'Slug harus menggunakan huruf kecil, angka, dan tanda hubung tanpa spasi.')
  assert.equal(invalid.description, 'Deskripsi wajib diisi.')
  assert.equal(invalid.price, 'Harga harus berupa Rupiah bulat bernilai 0 atau lebih.')
  assert.equal(invalid.file, 'Gunakan gambar JPG, PNG, atau WebP.')

  assert.equal(validateDigitalProductDraft({
    name: 'Business Case Handbook',
    slug: 'business-case-handbook',
    description: 'Panduan latihan kasus bisnis.',
    priceInput: '75000',
    file: { type: 'image/png', size: 5 * 1024 * 1024 + 1 },
    hasStoredImage: false,
  }).file, 'Ukuran gambar maksimal 5 MB.')

  assert.deepEqual(validateDigitalProductDraft({
    name: 'Business Case Handbook',
    slug: 'business-case-handbook',
    description: 'Panduan latihan kasus bisnis.',
    priceInput: '75000',
    file: null,
    hasStoredImage: true,
  }), {})
})

test('cover filenames and generated object paths stay inside the products namespace', () => {
  assert.equal(safeDigitalProductFileName('  Campaign Final (2).WEBP  '), 'campaign-final-2.webp')
  assert.equal(safeDigitalProductFileName('../../evil.png'), 'evil.png')
  assert.equal(safeDigitalProductFileName('???'), 'cover')
  const path = buildDigitalProductImagePath('../../My Cover.PNG')
  assert.match(path, /^products\/[0-9a-f-]+-my-cover\.png$/)
  assert.equal(path.includes('..'), false)
})

test('payload trims text, stores integer Rupiah, and preserves the stored cover when no replacement is selected', () => {
  assert.deepEqual(buildDigitalProductPayload({
    name: '  Business Case Handbook  ',
    slug: 'business-case-handbook',
    description: '  Panduan latihan kasus bisnis.  ',
    priceInput: '75000',
    imagePath: null,
    storedImagePath: 'products/current.webp',
  }), {
    name: 'Business Case Handbook',
    slug: 'business-case-handbook',
    description: 'Panduan latihan kasus bisnis.',
    image_path: 'products/current.webp',
    price_amount: 75000,
  })
})

test('setup and duplicate-slug errors are mapped to actionable safe admin feedback', () => {
  assert.equal(isDigitalProductSetupRequired({ code: 'PGRST205', message: 'table missing' }), true)
  assert.equal(isDigitalProductSetupRequired({ code: '42P01', message: 'relation "digital_products" does not exist' }), true)
  assert.equal(isDigitalProductSetupRequired({ code: '42501', message: 'permission denied' }), false)
  assert.equal(digitalProductMutationError({ code: '23505', message: 'duplicate key value violates unique constraint "digital_products_slug_key"' }), 'Slug sudah digunakan oleh Digital Product lain.')
  assert.equal(digitalProductMutationError({ code: 'XX500', message: 'private database detail' }), 'Digital Product belum dapat disimpan. Periksa koneksi lalu coba lagi.')
})
