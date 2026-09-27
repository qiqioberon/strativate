import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWhoWeArePhotoPayload,
  isWhoWeArePhotoSetupRequired,
  validateWhoWeArePhotoDraft,
} from '../lib/marketing/who-we-are-photo-admin'

const mb = 1024 * 1024

test('photo validation requires accurate alt text whenever an image will exist', () => {
  assert.deepEqual(validateWhoWeArePhotoDraft({
    altText: ' ',
    file: null,
    hasStoredImage: false,
    removeImage: false,
  }), {
    file: 'Choose an image for this slot.',
  })

  assert.equal(validateWhoWeArePhotoDraft({
    altText: ' ',
    file: null,
    hasStoredImage: true,
    removeImage: false,
  }).altText, 'Alt text is required when an image exists.')

  assert.deepEqual(validateWhoWeArePhotoDraft({
    altText: 'Students preparing a competition presentation',
    file: null,
    hasStoredImage: true,
    removeImage: false,
  }), {})

  assert.deepEqual(validateWhoWeArePhotoDraft({
    altText: '',
    file: null,
    hasStoredImage: true,
    removeImage: true,
  }), {})
})

test('photo validation accepts supported images and rejects unsafe uploads', () => {
  assert.deepEqual(validateWhoWeArePhotoDraft({
    altText: 'Mentor reviewing a student proposal',
    file: { type: 'image/webp', size: 8 * mb },
    hasStoredImage: false,
    removeImage: false,
  }), {})
  assert.equal(validateWhoWeArePhotoDraft({
    altText: 'Photo',
    file: { type: 'image/svg+xml', size: 100 },
    hasStoredImage: false,
    removeImage: false,
  }).file, 'Use a JPG, PNG, or WebP image.')
  assert.equal(validateWhoWeArePhotoDraft({
    altText: 'Photo',
    file: { type: 'image/png', size: 8 * mb + 1 },
    hasStoredImage: false,
    removeImage: false,
  }).file, 'Image size must be 8 MB or smaller.')
})

test('payload preserves stored media for metadata-only edits and normalizes badges', () => {
  assert.deepEqual(buildWhoWeArePhotoPayload({
    altText: ' Students collaborating at a table ',
    badgeText: '  Collaborative preparation  ',
    uploadedPath: null,
    storedImagePath: 'who-we-are/primary/existing.webp',
    removeImage: false,
  }), {
    image_path: 'who-we-are/primary/existing.webp',
    alt_text: 'Students collaborating at a table',
    badge_text: 'Collaborative preparation',
  })

  assert.equal(buildWhoWeArePhotoPayload({
    altText: 'Student presenting',
    badgeText: '   ',
    uploadedPath: 'who-we-are/upper_right/new.webp',
    storedImagePath: 'who-we-are/upper_right/old.webp',
    removeImage: false,
  }).badge_text, null)

  assert.deepEqual(buildWhoWeArePhotoPayload({
    altText: 'Ignored after removal',
    badgeText: 'Ignored after removal',
    uploadedPath: null,
    storedImagePath: 'who-we-are/lower_right/old.webp',
    removeImage: true,
  }), {
    image_path: null,
    alt_text: null,
    badge_text: null,
  })
})

test('setup detection is limited to missing who-we-are schema failures', () => {
  assert.equal(isWhoWeArePhotoSetupRequired({ code: '42P01' }), true)
  assert.equal(isWhoWeArePhotoSetupRequired({ code: 'PGRST205' }), true)
  assert.equal(isWhoWeArePhotoSetupRequired({ message: "Could not find 'homepage_who_we_are_photos' in the schema cache" }), true)
  assert.equal(isWhoWeArePhotoSetupRequired({ message: 'network unavailable' }), false)
  assert.equal(isWhoWeArePhotoSetupRequired({ code: '42501' }), false)
})
