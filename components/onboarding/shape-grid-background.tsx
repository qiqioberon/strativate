'use client'

import { useEffect, useRef } from 'react'

const GRID_BORDER = '#d7d7d7'
const GRID_ACCENT = '#ff7a00'
const GRID_SIZE = 30
const GRID_SPEED = 0.3
const ACCENT_PHASE_MS = 5200
const ACCENT_THRESHOLD = 0.995

function fract(value: number) {
  return value - Math.floor(value)
}

function cellHash(column: number, row: number, phase: number) {
  return fract(Math.sin(column * 12.9898 + row * 78.233 + phase * 37.719) * 43758.5453)
}

function ease(value: number) {
  return value * value * (3 - 2 * value)
}

export function OnboardingShapeGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionQuery.matches
    let width = 0
    let height = 0
    let animationFrame: number | null = null
    let animationStart = performance.now()
    let pageVisible = !document.hidden

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const draw = (timestamp: number) => {
      context.clearRect(0, 0, width, height)

      const elapsed = reducedMotion ? 0 : Math.max(0, timestamp - animationStart)
      const travel = reducedMotion ? 0 : (elapsed / (1000 / 60)) * GRID_SPEED
      const wrappedTravel = travel % GRID_SIZE
      const columnShift = Math.floor(travel / GRID_SIZE)
      const offsetX = -wrappedTravel
      const phase = Math.floor(elapsed / ACCENT_PHASE_MS)
      const phaseMix = ease((elapsed % ACCENT_PHASE_MS) / ACCENT_PHASE_MS)
      const columns = Math.ceil(width / GRID_SIZE) + 3
      const rows = Math.ceil(height / GRID_SIZE) + 2

      context.lineWidth = 1

      for (let column = -1; column < columns; column += 1) {
        for (let row = -1; row < rows; row += 1) {
          const x = column * GRID_SIZE + offsetX
          const y = row * GRID_SIZE
          const logicalColumn = column + columnShift
          const currentAccent = cellHash(logicalColumn, row, phase) > ACCENT_THRESHOLD ? 1 : 0
          const nextAccent = cellHash(logicalColumn, row, phase + 1) > ACCENT_THRESHOLD ? 1 : 0
          const accentAlpha = (currentAccent * (1 - phaseMix) + nextAccent * phaseMix) * 0.34

          if (accentAlpha > 0.01) {
            context.globalAlpha = accentAlpha
            context.fillStyle = GRID_ACCENT
            context.fillRect(x + 1, y + 1, GRID_SIZE - 2, GRID_SIZE - 2)
          }

          context.globalAlpha = 0.72
          context.strokeStyle = GRID_BORDER
          context.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, GRID_SIZE, GRID_SIZE)
        }
      }

      context.globalAlpha = 1
    }

    const stop = () => {
      if (animationFrame === null) return
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    const tick = (timestamp: number) => {
      draw(timestamp)
      animationFrame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (reducedMotion || !pageVisible || animationFrame !== null) {
        draw(performance.now())
        return
      }
      animationFrame = requestAnimationFrame(tick)
    }

    const handleMotionPreference = () => {
      reducedMotion = reducedMotionQuery.matches
      animationStart = performance.now()
      stop()
      start()
    }

    const handleVisibility = () => {
      pageVisible = !document.hidden
      if (pageVisible) start()
      else stop()
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    reducedMotionQuery.addEventListener('change', handleMotionPreference)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      reducedMotionQuery.removeEventListener('change', handleMotionPreference)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return <div className="onboarding-shape-grid" aria-hidden="true">
    <canvas ref={canvasRef} className="onboarding-shape-grid__canvas" />
  </div>
}
