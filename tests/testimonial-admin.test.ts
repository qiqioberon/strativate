import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTestimonialAltText,
  buildTestimonialPayload,
  getNextTestimonialSortOrder,
  isTestimonialSetupRequired,
  normalizeTestimonialSlug,
  reorderTestimonialIds,
  validateTestimonialDraft,
} from '../lib/marketing/testimonial-admin'
import {
  TESTIMONIAL_IMAGE_ASPECT_RATIO,
  TESTIMONIAL_IMAGE_HEIGHT,
  TESTIMONIAL_IMAGE_WIDTH,
} from '../lib/marketing/testimonial-config'
import {
  calculateTestimonialSourceCrop,
  DEFAULT_TESTIMONIAL_CROP,
} from '../lib/marketing/testimonial-image'
import type { MarketingTestimonial } from '../lib/supabase/database.types'

function item(id: string, sortOrder: number): MarketingTestimonial {
  return {
    id,
    slug: id,
    competition_name: `Competition ${id}`,
    achievement: '1st Place',
    testimonial: 'Testimoni peserta.',
    image_path: null,
    sort_order: sortOrder,
    is_published: true,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  }
}

test('testimonial drafts validate copy while allowing seeded rows to exist without images', () => {
  assert.deepEqual(validateTestimonialDraft({
    slug: 'business-plan-competition',
    competitionName: 'Business Plan Competition',
    achievement: '1st Place',
    testimonial: 'Bimbingannya membantu kami menyusun strategi.',
    file: null,
  }), {})

  assert.equal(validateTestimonialDraft({
    slug: '',
    competitionName: '',
    achievement: '',
    testimonial: '',
    file: null,
  }).competitionName, 'Nama kompetisi wajib diisi.')

  assert.equal(validateTestimonialDraft({
    slug: 'valid-slug',
    competitionName: 'Competition',
    achievement: 'Winner',
    testimonial: 'Copy',
    file: { type: 'image/gif', size: 100 },
  }).file, 'Gunakan gambar JPG, PNG, atau WebP.')
})

test('testimonial slugs are normalized for database constraints', () => {
  assert.equal(normalizeTestimonialSlug('Business Plan Competition Prasmul ECC'), 'business-plan-competition-prasmul-ecc')
  assert.equal(normalizeTestimonialSlug('  IMPACT UBM 2026! '), 'impact-ubm-2026')
})

test('testimonial payload preserves stored image when admin only edits copy', () => {
  assert.deepEqual(buildTestimonialPayload({
    slug: 'competition-story',
    competitionName: 'Competition Story',
    achievement: '2nd Place',
    testimonial: '  Proses mentoring membuat strategi kami lebih jelas.  ',
    imagePath: null,
    storedImagePath: 'testimonials/current.webp',
    isPublished: true,
  }), {
    slug: 'competition-story',
    competition_name: 'Competition Story',
    achievement: '2nd Place',
    testimonial: 'Proses mentoring membuat strategi kami lebih jelas.',
    image_path: 'testimonials/current.webp',
    is_published: true,
  })
})

test('testimonial ordering is deterministic and append-safe', () => {
  const items = [item('one', 1), item('two', 2), item('three', 3)]
  assert.equal(getNextTestimonialSortOrder([]), 1)
  assert.equal(getNextTestimonialSortOrder(items), 4)
  assert.deepEqual(reorderTestimonialIds(items, 0, 1), ['two', 'one', 'three'])
  assert.deepEqual(reorderTestimonialIds(items, 2, 1), ['one', 'two', 'three'])
})

test('testimonial setup detection only treats missing schema as setup required', () => {
  assert.equal(isTestimonialSetupRequired({ code: 'PGRST205', message: 'missing table' }), true)
  assert.equal(isTestimonialSetupRequired({ code: '42P01', message: 'relation marketing_testimonials does not exist' }), true)
  assert.equal(isTestimonialSetupRequired({ code: '42501', message: 'permission denied' }), false)
})


test('testimonial alt text is generated from the competition name instead of an admin field', () => {
  assert.equal(buildTestimonialAltText('UNDIP Business Plan Competition'), 'Peserta UNDIP Business Plan Competition setelah kompetisi.')
  assert.equal(buildTestimonialAltText(''), 'Peserta Strativate setelah kompetisi.')
})

test('testimonial storage image standard is 5:4 at 1200 by 960 and crops sources predictably', () => {
  assert.equal(TESTIMONIAL_IMAGE_WIDTH, 1200)
  assert.equal(TESTIMONIAL_IMAGE_HEIGHT, 960)
  assert.equal(TESTIMONIAL_IMAGE_ASPECT_RATIO, 1.25)

  const landscape = calculateTestimonialSourceCrop(1600, 900, DEFAULT_TESTIMONIAL_CROP)
  assert.ok(Math.abs(landscape.width / landscape.height - 1.25) < 0.0001)
  assert.ok(landscape.x > 0)
  assert.equal(landscape.y, 0)

  const portrait = calculateTestimonialSourceCrop(800, 1200, DEFAULT_TESTIMONIAL_CROP)
  assert.ok(Math.abs(portrait.width / portrait.height - 1.25) < 0.0001)
  assert.equal(portrait.x, 0)
  assert.ok(portrait.y > 0)
})
