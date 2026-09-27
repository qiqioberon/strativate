import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPETITION_RECOGNITION_LOGO_HEIGHT,
  COMPETITION_RECOGNITION_LOGO_WIDTH,
} from '../lib/marketing/competition-recognition-config'
import {
  calculateCompetitionRecognitionLogoPlacement,
  DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT,
  normalizeCompetitionRecognitionLogoFit,
} from '../lib/marketing/competition-recognition-image'

const shapes = [
  [320, 80],
  [160, 160],
  [80, 240],
  [280, 120],
  [1200, 180],
] as const

test('default recognition logo fitting contains heterogeneous source shapes inside the 5:2 canvas', () => {
  for (const [width, height] of shapes) {
    const placement = calculateCompetitionRecognitionLogoPlacement(
      width,
      height,
      DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT,
    )

    assert.ok(placement.x >= 0, 'x should remain inside the output canvas')
    assert.ok(placement.y >= 0, 'y should remain inside the output canvas')
    assert.ok(
      placement.x + placement.width <= COMPETITION_RECOGNITION_LOGO_WIDTH + .001,
      'fitted logo should not overflow horizontally',
    )
    assert.ok(
      placement.y + placement.height <= COMPETITION_RECOGNITION_LOGO_HEIGHT + .001,
      'fitted logo should not overflow vertically',
    )
    assert.ok(Math.abs((placement.width / placement.height) - (width / height)) < .0001)
  }
})

test('recognition logo fitting clamps controls and allows deliberate zoom beyond the safe frame', () => {
  assert.deepEqual(
    normalizeCompetitionRecognitionLogoFit({ x: -20, y: 120, zoom: 9 }),
    { x: 0, y: 100, zoom: 2.5 },
  )

  const fitted = calculateCompetitionRecognitionLogoPlacement(160, 160, {
    x: 50,
    y: 50,
    zoom: 1,
  })
  const zoomed = calculateCompetitionRecognitionLogoPlacement(160, 160, {
    x: 50,
    y: 50,
    zoom: 2.5,
  })

  assert.ok(zoomed.width > fitted.width)
  assert.ok(zoomed.height > fitted.height)
})

test('recognition logo position controls move contained logos without changing their aspect ratio', () => {
  const left = calculateCompetitionRecognitionLogoPlacement(320, 80, { x: 0, y: 0, zoom: 1 })
  const right = calculateCompetitionRecognitionLogoPlacement(320, 80, { x: 100, y: 100, zoom: 1 })

  assert.ok(right.x > left.x)
  assert.ok(right.y > left.y)
  assert.equal(left.width, right.width)
  assert.equal(left.height, right.height)
})
