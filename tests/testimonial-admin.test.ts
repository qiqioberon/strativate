import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTestimonialPayload,
  getNextTestimonialSortOrder,
  isTestimonialSetupRequired,
  normalizeTestimonialSlug,
  reorderTestimonialIds,
  safeTestimonialFileName,
  validateTestimonialDraft,
} from '../lib/marketing/testimonial-admin'
import type { MarketingTestimonial } from '../lib/supabase/database.types'

function item(id: string, sortOrder: number): MarketingTestimonial {
  return {
    id,
    slug: id,
    competition_name: `Competition ${id}`,
    achievement: '1st Place',
    testimonial: 'Testimoni peserta.',
    participant_label: null,
    image_path: null,
    alt_text: 'Foto peserta.',
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
    altText: 'Tim setelah kompetisi.',
    file: null,
  }), {})

  assert.equal(validateTestimonialDraft({
    slug: '',
    competitionName: '',
    achievement: '',
    testimonial: '',
    altText: '',
    file: null,
  }).competitionName, 'Nama kompetisi wajib diisi.')

  assert.equal(validateTestimonialDraft({
    slug: 'valid-slug',
    competitionName: 'Competition',
    achievement: 'Winner',
    testimonial: 'Copy',
    altText: 'Alt',
    file: { type: 'image/gif', size: 100 },
  }).file, 'Gunakan gambar JPG, PNG, atau WebP.')
})

test('testimonial slugs and filenames are normalized for storage and database constraints', () => {
  assert.equal(normalizeTestimonialSlug('Business Plan Competition Prasmul ECC'), 'business-plan-competition-prasmul-ecc')
  assert.equal(normalizeTestimonialSlug('  IMPACT UBM 2026! '), 'impact-ubm-2026')
  assert.equal(safeTestimonialFileName('Team Final (2).WEBP'), 'team-final-2-.webp')
})

test('testimonial payload preserves stored image when admin only edits copy', () => {
  assert.deepEqual(buildTestimonialPayload({
    slug: 'competition-story',
    competitionName: 'Competition Story',
    achievement: '2nd Place',
    testimonial: '  Proses mentoring membuat strategi kami lebih jelas.  ',
    participantLabel: '',
    altText: '  Tim kompetisi.  ',
    imagePath: null,
    storedImagePath: 'testimonials/current.webp',
    isPublished: true,
  }), {
    slug: 'competition-story',
    competition_name: 'Competition Story',
    achievement: '2nd Place',
    testimonial: 'Proses mentoring membuat strategi kami lebih jelas.',
    participant_label: null,
    alt_text: 'Tim kompetisi.',
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
