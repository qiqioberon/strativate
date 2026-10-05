import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateCoverImagePlacement,
  normalizeImageFit,
} from '../lib/media/image-fit'

test('cover image fitting always fills the 4:5 target frame without letterboxing', () => {
  const landscape = calculateCoverImagePlacement(1600, 900, 1000, 1250, { x: 50, y: 50, zoom: 1 })
  assert.equal(landscape.height, 1250)
  assert.ok(landscape.width > 1000)
  assert.ok(landscape.x < 0)
  assert.equal(landscape.y, 0)

  const portrait = calculateCoverImagePlacement(800, 1600, 1000, 1250, { x: 50, y: 50, zoom: 1 })
  assert.equal(portrait.width, 1000)
  assert.ok(portrait.height > 1250)
  assert.equal(portrait.x, 0)
  assert.ok(portrait.y < 0)
})

test('image fit normalization clamps focal position and zoom', () => {
  assert.deepEqual(
    normalizeImageFit({ x: -20, y: 140, zoom: 9 }, 1, 3),
    { x: 0, y: 100, zoom: 3 },
  )
})

test('focal controls move the crop across image overflow', () => {
  const left = calculateCoverImagePlacement(1600, 900, 1000, 1250, { x: 0, y: 50, zoom: 1 })
  const right = calculateCoverImagePlacement(1600, 900, 1000, 1250, { x: 100, y: 50, zoom: 1 })
  assert.equal(left.x, 0)
  assert.ok(right.x < left.x)
})
