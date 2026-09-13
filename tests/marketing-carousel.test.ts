import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAROUSEL_AUTOPLAY_DELAY,
  beginCarouselPointer,
  finishCarouselPointer,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
  hasCarouselControls,
  selectCarouselForAction,
  selectCarouselIndex,
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

test('carousel pointer completion clears pause state after an outside release or cancelled gesture', () => {
  const mousePointer = beginCarouselPointer('mouse', 40)
  assert.deepEqual(finishCarouselPointer(mousePointer, 300, 3), { isActive: false, direction: null })

  const touchPointer = beginCarouselPointer('touch', 200)
  assert.deepEqual(finishCarouselPointer(touchPointer, 80, 3), { isActive: false, direction: 'next' })
  assert.deepEqual(finishCarouselPointer(touchPointer, null, 3), { isActive: false, direction: null })
})

test('manual carousel selections always issue a fresh scheduling version', () => {
  assert.deepEqual(selectCarouselIndex({ index: 0, scheduleVersion: 4 }, 2, 3), { index: 2, scheduleVersion: 5 })
  assert.deepEqual(selectCarouselIndex({ index: 2, scheduleVersion: 5 }, getPreviousCarouselIndex(2, 3), 3), { index: 1, scheduleVersion: 6 })
  assert.deepEqual(selectCarouselIndex({ index: 1, scheduleVersion: 6 }, getNextCarouselIndex(1, 3), 3), { index: 2, scheduleVersion: 7 })
})

test('every manual carousel action resets the scheduling version', () => {
  const start = { index: 1, scheduleVersion: 0 }
  assert.deepEqual(selectCarouselForAction(start, 'previous', 3), { index: 0, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'next', 3), { index: 2, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'dot', 3, 0), { index: 0, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'keyboard-previous', 3), { index: 0, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'keyboard-next', 3), { index: 2, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'swipe-previous', 3), { index: 0, scheduleVersion: 1 })
  assert.deepEqual(selectCarouselForAction(start, 'swipe-next', 3), { index: 2, scheduleVersion: 1 })
})
