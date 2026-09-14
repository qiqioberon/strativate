import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildHeroPosterPayload,
  getHeroPosterSummary,
  getNextHeroPosterSortOrder,
  isHeroPosterSetupRequired,
  moveHeroPosterIdToPosition,
  reorderHeroPosterIds,
  safeHeroPosterFileName,
  validateHeroPosterDraft,
} from '../lib/marketing/hero-poster-admin'
import type { MarketingHeroPoster } from '../lib/supabase/database.types'

const poster = (id: string, isActive: boolean, sortOrder: number): MarketingHeroPoster => ({
  id,
  image_path: `posters/${id}.webp`,
  alt_text: `Poster ${id}`,
  title: null,
  url: null,
  sort_order: sortOrder,
  is_active: isActive,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
})

test('carousel readiness distinguishes fallback, single poster, and active carousel states', () => {
  assert.deepEqual(getHeroPosterSummary([]), {
    total: 0,
    active: 0,
    inactive: 0,
    label: 'Fallback aktif',
    message: 'Beranda masih menggunakan visual brand bawaan.',
    tone: 'fallback',
  })
  assert.equal(getHeroPosterSummary([poster('one', true, 1)]).label, 'Poster tunggal')
  assert.deepEqual(getHeroPosterSummary([poster('one', true, 1), poster('two', true, 2)]), {
    total: 2,
    active: 2,
    inactive: 0,
    label: 'Carousel aktif',
    message: '2 poster aktif akan diputar otomatis di beranda.',
    tone: 'carousel',
  })
  assert.deepEqual(getHeroPosterSummary([poster('one', true, 1), poster('two', false, 2)]), {
    total: 2,
    active: 1,
    inactive: 1,
    label: 'Poster tunggal',
    message: 'Poster akan tampil di hero, tetapi carousel tidak berpindah karena hanya ada satu poster aktif.',
    tone: 'single',
  })
})

test('database setup detection recognizes PGRST205 and equivalent missing-resource errors only', () => {
  assert.equal(isHeroPosterSetupRequired({ code: 'PGRST205', message: 'table missing' }), true)
  assert.equal(isHeroPosterSetupRequired({ code: '42P01', message: 'relation "marketing_hero_posters" does not exist' }), true)
  assert.equal(isHeroPosterSetupRequired({ code: '42501', message: 'permission denied' }), false)
})

test('poster validation rejects invalid content and only validates position while editing', () => {
  assert.equal(validateHeroPosterDraft({ altText: '', url: '', file: null, hasStoredImage: true }).altText, 'Teks alternatif wajib diisi.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '//evil.test', file: null, hasStoredImage: true }).url, 'Gunakan path internal yang diawali / dan bukan //.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/program', file: { type: 'image/gif', size: 100 }, hasStoredImage: false }).file, 'Gunakan gambar JPG, PNG, atau WebP.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/program', file: { type: 'image/png', size: 5 * 1024 * 1024 + 1 }, hasStoredImage: false }).file, 'Ukuran gambar maksimal 5 MB.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/program', position: '', posterCount: 3, file: null, hasStoredImage: true }).position, 'Posisi wajib diisi.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/program', position: '4', posterCount: 3, file: null, hasStoredImage: true }).position, 'Posisi harus berupa bilangan bulat antara 1 dan 3.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/path with spaces', file: { type: 'image/webp', size: 100 }, hasStoredImage: false }).url, 'Gunakan path internal tanpa spasi atau karakter yang tidak didukung.')
  assert.equal(validateHeroPosterDraft({ altText: 'Poster', url: '/\\evil.test', file: { type: 'image/webp', size: 100 }, hasStoredImage: false }).url, 'Gunakan path internal tanpa spasi atau karakter yang tidak didukung.')
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.deepEqual(validateHeroPosterDraft({ altText: 'Poster', url: '/program', file: { type, size: 5 * 1024 * 1024 }, hasStoredImage: false }), {})
  }
  assert.deepEqual(validateHeroPosterDraft({ altText: 'Poster', url: '/program', position: '2', posterCount: 3, file: null, hasStoredImage: true }), {})
})

test('uploaded poster names stay unique-path safe without trusting the original filename', () => {
  assert.equal(safeHeroPosterFileName('  Campaign Final (2).WEBP  '), 'campaign-final-2-.webp')
  assert.equal(safeHeroPosterFileName('???'), 'poster')
})

test('editing without a replacement retains the stored image path and leaves ordering to the reorder flow', () => {
  assert.deepEqual(buildHeroPosterPayload({
    imagePath: null,
    storedImagePath: 'posters/current.webp',
    altText: 'Poster yang diperbarui',
    title: '',
    url: '',
    isActive: false,
  }), {
    image_path: 'posters/current.webp',
    alt_text: 'Poster yang diperbarui',
    title: null,
    url: null,
    is_active: false,
  })
})

test('new posters append after the greatest stored order so they stay last before normalization', () => {
  assert.equal(getNextHeroPosterSortOrder([]), 1)
  assert.equal(getNextHeroPosterSortOrder([poster('one', true, 1), poster('two', true, 2)]), 3)
  assert.equal(getNextHeroPosterSortOrder([poster('one', true, 10), poster('two', true, 20)]), 21)
})

test('editing can move a poster directly to a natural one-based position', () => {
  const posters = [poster('one', true, 1), poster('two', false, 2), poster('three', true, 3)]
  assert.deepEqual(moveHeroPosterIdToPosition(posters, 'three', 1), ['three', 'one', 'two'])
  assert.deepEqual(moveHeroPosterIdToPosition(posters, 'one', 3), ['two', 'three', 'one'])
  assert.deepEqual(moveHeroPosterIdToPosition(posters, 'two', 2), ['one', 'two', 'three'])
  assert.deepEqual(moveHeroPosterIdToPosition(posters, 'missing', 1), ['one', 'two', 'three'])
  assert.deepEqual(moveHeroPosterIdToPosition(posters, 'one', 0), ['one', 'two', 'three'])
})

test('quick up and down reordering returns the exact protected RPC identity sequence', () => {
  const posters = [poster('one', true, 1), poster('two', false, 2), poster('three', true, 3)]
  assert.deepEqual(reorderHeroPosterIds(posters, 0, 1), ['two', 'one', 'three'])
  assert.deepEqual(reorderHeroPosterIds(posters, 0, -1), ['one', 'two', 'three'])
  assert.deepEqual(reorderHeroPosterIds(posters, 2, 1), ['one', 'two', 'three'])
})
