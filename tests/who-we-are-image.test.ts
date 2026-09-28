import assert from 'node:assert/strict'
import test from 'node:test'

import {
  WHO_WE_ARE_PHOTO_TARGETS,
  type WhoWeArePhotoRole,
} from '../lib/marketing/who-we-are-photo-config'
import {
  calculateWhoWeArePreviewPlacement,
  calculateWhoWeAreSourceCrop,
  cropWhoWeArePhoto,
  DEFAULT_WHO_WE_ARE_CROP,
  normalizeWhoWeAreCrop,
} from '../lib/marketing/who-we-are-photo-image'

const roles: WhoWeArePhotoRole[] = ['primary', 'upper_right', 'lower_right']

test('who-we-are slots start with one portrait and two square supporting targets', () => {
  assert.deepEqual(WHO_WE_ARE_PHOTO_TARGETS.primary, {
    label: 'Primary photo',
    width: 1200,
    height: 1600,
  })
  assert.deepEqual(WHO_WE_ARE_PHOTO_TARGETS.upper_right, {
    label: 'Upper-right photo',
    width: 1000,
    height: 1000,
  })
  assert.deepEqual(WHO_WE_ARE_PHOTO_TARGETS.lower_right, {
    label: 'Lower-right photo',
    width: 1000,
    height: 1000,
  })
})

test('default crop covers every role target without distortion', () => {
  for (const role of roles) {
    for (const [sourceWidth, sourceHeight] of [[2400, 1600], [1600, 2400], [1800, 1800]]) {
      const crop = calculateWhoWeAreSourceCrop(
        sourceWidth,
        sourceHeight,
        role,
        DEFAULT_WHO_WE_ARE_CROP,
      )
      const target = WHO_WE_ARE_PHOTO_TARGETS[role]

      assert.ok(crop.x >= 0)
      assert.ok(crop.y >= 0)
      assert.ok(crop.x + crop.width <= sourceWidth + .001)
      assert.ok(crop.y + crop.height <= sourceHeight + .001)
      assert.ok(Math.abs(crop.width / crop.height - target.width / target.height) < .0001)
    }
  }
})

test('crop controls clamp and reposition a stable source crop', () => {
  assert.deepEqual(normalizeWhoWeAreCrop({ x: -10, y: 120, zoom: 8 }), {
    x: 0,
    y: 100,
    zoom: 3,
  })

  const topLeft = calculateWhoWeAreSourceCrop(2400, 1600, 'lower_right', { x: 0, y: 0, zoom: 1 })
  const bottomRight = calculateWhoWeAreSourceCrop(2400, 1600, 'lower_right', { x: 100, y: 100, zoom: 1 })
  const zoomed = calculateWhoWeAreSourceCrop(2400, 1600, 'lower_right', { x: 50, y: 50, zoom: 2 })

  assert.ok(bottomRight.x > topLeft.x)
  assert.equal(bottomRight.y, topLeft.y)
  assert.equal(bottomRight.width, topLeft.width)
  assert.ok(zoomed.width < topLeft.width)
  assert.ok(zoomed.height < topLeft.height)
})

test('editor preview uses the same source geometry as the saved crop', () => {
  const placement = calculateWhoWeArePreviewPlacement(2400, 1600, 'primary', {
    x: 100,
    y: 50,
    zoom: 2,
  })

  assert.deepEqual(placement, {
    left: -300,
    top: -50,
    width: 400,
    height: 200,
  })
})

test('oversized decoded images are rejected and their bitmap is always released', async () => {
  const originalBitmap = globalThis.createImageBitmap
  let closed = false
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: async () => ({ width: 10_000, height: 5_000, close: () => { closed = true } }),
  })

  try {
    await assert.rejects(
      cropWhoWeArePhoto({} as File, 'primary', DEFAULT_WHO_WE_ARE_CROP),
      /too large to process safely/,
    )
    assert.equal(closed, true)
  } finally {
    if (originalBitmap) {
      Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: originalBitmap })
    } else {
      Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: undefined })
    }
  }
})
