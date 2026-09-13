import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAROUSEL_AUTOPLAY_DELAY,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
  hasCarouselControls,
  shouldScheduleCarousel,
} from '../lib/marketing/carousel'

test('carousel navigation wraps in both directions', () => {
  assert.equal(getNextCarouselIndex(2, 3), 0)
  assert.equal(getPreviousCarouselIndex(0, 3), 2)
  assert.equal(getNextCarouselIndex(0, 0), 0)
  assert.equal(getPreviousCarouselIndex(0, 0), 0)
})

test('carousel schedules only an unpaused multi-poster experience for five seconds', () => {
  assert.equal(CAROUSEL_AUTOPLAY_DELAY, 5000)
  assert.equal(shouldScheduleCarousel({ posterCount: 0, paused: false, reducedMotion: false }), false)
  assert.equal(shouldScheduleCarousel({ posterCount: 1, paused: false, reducedMotion: false }), false)
  assert.equal(shouldScheduleCarousel({ posterCount: 2, paused: true, reducedMotion: false }), false)
  assert.equal(shouldScheduleCarousel({ posterCount: 2, paused: false, reducedMotion: true }), false)
  assert.equal(shouldScheduleCarousel({ posterCount: 2, paused: false, reducedMotion: false }), true)
})

test('carousel controls are reserved for multiple posters', () => {
  assert.equal(hasCarouselControls(0), false)
  assert.equal(hasCarouselControls(1), false)
  assert.equal(hasCarouselControls(2), true)
})
