'use client'

/*
 * Adapted for Strativate from React Bits Shape Grid.
 * Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
 * Full third-party notice: /THIRD_PARTY_NOTICES.md
 */

import { useEffect, useRef } from 'react'

type CanvasStrokeStyle = string | CanvasGradient | CanvasPattern
type GridOffset = { x: number; y: number }
type ShapeGridDirection = 'diagonal' | 'up' | 'right' | 'down' | 'left'
type ShapeGridShape = 'square' | 'hexagon' | 'circle' | 'triangle'

type ShapeGridProps = {
  direction?: ShapeGridDirection
  speed?: number
  borderColor?: CanvasStrokeStyle
  squareSize?: number
  shape?: ShapeGridShape
  fadeColor?: string
}

function ShapeGrid({
  direction = 'right',
  speed = 1,
  borderColor = '#999',
  squareSize = 40,
  shape = 'square',
  fadeColor = '#120F17',
}: ShapeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number | null>(null)
  const gridOffset = useRef<GridOffset>({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isHex = shape === 'hexagon'
    const isTri = shape === 'triangle'
    const hexHoriz = squareSize * 1.5
    const hexVert = squareSize * Math.sqrt(3)
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionQuery.matches
    let isVisible = false
    let isPageVisible = !document.hidden

    const drawHex = (cx: number, cy: number, size: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const vx = cx + size * Math.cos(angle)
        const vy = cy + size * Math.sin(angle)
        if (i === 0) ctx.moveTo(vx, vy)
        else ctx.lineTo(vx, vy)
      }
      ctx.closePath()
    }

    const drawCircle = (cx: number, cy: number, size: number) => {
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.closePath()
    }

    const drawTriangle = (cx: number, cy: number, size: number, flip: boolean) => {
      ctx.beginPath()
      if (flip) {
        ctx.moveTo(cx, cy + size / 2)
        ctx.lineTo(cx + size / 2, cy - size / 2)
        ctx.lineTo(cx - size / 2, cy - size / 2)
      } else {
        ctx.moveTo(cx, cy - size / 2)
        ctx.lineTo(cx + size / 2, cy + size / 2)
        ctx.lineTo(cx - size / 2, cy + size / 2)
      }
      ctx.closePath()
    }

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz)
        const offsetX = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz
        const offsetY = ((gridOffset.current.y % hexVert) + hexVert) % hexVert
        const cols = Math.ceil(canvas.width / hexHoriz) + 3
        const rows = Math.ceil(canvas.height / hexVert) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * hexHoriz + offsetX
            const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY
            drawHex(cx, cy, squareSize)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else if (isTri) {
        const halfW = squareSize / 2
        const colShift = Math.floor(gridOffset.current.x / halfW)
        const rowShift = Math.floor(gridOffset.current.y / squareSize)
        const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / halfW) + 4
        const rows = Math.ceil(canvas.height / squareSize) + 4

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * halfW + offsetX
            const cy = row * squareSize + squareSize / 2 + offsetY
            const flip = ((col + colShift + row + rowShift) % 2 + 2) % 2 !== 0
            drawTriangle(cx, cy, squareSize, flip)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else if (shape === 'circle') {
        const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / squareSize) + 3
        const rows = Math.ceil(canvas.height / squareSize) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * squareSize + squareSize / 2 + offsetX
            const cy = row * squareSize + squareSize / 2 + offsetY
            drawCircle(cx, cy, squareSize)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else {
        const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / squareSize) + 3
        const rows = Math.ceil(canvas.height / squareSize) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const sx = col * squareSize + offsetX
            const sy = row * squareSize + offsetY
            ctx.strokeStyle = borderColor
            ctx.strokeRect(sx, sy, squareSize, squareSize)
          }
        }
      }

      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.sqrt(canvas.width ** 2 + canvas.height ** 2) / 2,
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, fadeColor)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const renderFrame = () => drawGrid()

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1)
      const wrapX = isHex ? hexHoriz * 2 : squareSize
      const wrapY = isHex ? hexVert : isTri ? squareSize * 2 : squareSize

      switch (direction) {
        case 'right':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX
          break
        case 'left':
          gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + wrapX) % wrapX
          break
        case 'up':
          gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + wrapY) % wrapY
          break
        case 'down':
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY
          break
        case 'diagonal':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY
          break
      }

      renderFrame()
      requestRef.current = window.requestAnimationFrame(updateAnimation)
    }

    const tryStop = () => {
      if (requestRef.current === null) return
      window.cancelAnimationFrame(requestRef.current)
      requestRef.current = null
    }

    const tryStart = () => {
      if (!isVisible || !isPageVisible) return
      if (reducedMotion) {
        tryStop()
        renderFrame()
        return
      }
      if (requestRef.current === null) requestRef.current = window.requestAnimationFrame(updateAnimation)
    }

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      renderFrame()
    }

    const onVisibility = () => {
      isPageVisible = !document.hidden
      if (isPageVisible) tryStart()
      else tryStop()
    }

    const onReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      canvas.dataset.motion = reducedMotion ? 'reduced' : 'animated'
      if (reducedMotion) {
        tryStop()
        renderFrame()
      } else {
        tryStart()
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) tryStart()
        else tryStop()
      },
      { threshold: 0 },
    )

    canvas.dataset.motion = reducedMotion ? 'reduced' : 'animated'
    window.addEventListener('resize', resizeCanvas)
    document.addEventListener('visibilitychange', onVisibility)
    reducedMotionQuery.addEventListener('change', onReducedMotion)
    resizeCanvas()
    observer.observe(canvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotionQuery.removeEventListener('change', onReducedMotion)
      observer.disconnect()
      tryStop()
    }
  }, [direction, speed, borderColor, squareSize, shape, fadeColor])

  return (
    <canvas
      ref={canvasRef}
      className="homepage-shape-grid"
      aria-hidden="true"
      data-react-bits="shape-grid"
      data-testid="hero-shape-grid"
    />
  )
}

export function HeroShapeGrid() {
  return (
    <ShapeGrid
      direction="diagonal"
      speed={0.45}
      borderColor="rgba(255,255,255,.28)"
      squareSize={48}
      shape="square"
      fadeColor="rgba(104,26,0,.16)"
    />
  )
}
